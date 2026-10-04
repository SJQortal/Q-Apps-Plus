import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetchMock, fetchedUrls } from '../../test/setup'
import { resetSearchCache, searchResources } from '../../utils/qdnSearch'
import {
  ALIAS_SCAN_SEARCH_TTL_MS,
  aliasNamesFromBody,
  aliasScanButtonLabel,
  aliasScanSearchParams,
  readAliasScanCheckpointFromStorage,
  readAliasScanSeenFromStorage,
  runAliasScanPass,
  toAliasScanCandidate,
  writeAliasScanCheckpointToStorage,
  writeAliasScanSeenToStorage,
  type AliasScanCandidate,
  type AliasScanCheckpoint,
} from './aliasScan'

const ADDRESS = 'QMyWalletAddress1234'
const SUFFIX = 'ABCDEF'

/** A fake `qortal_qmail_` index, newest first. Every 10th resource is alias mail. */
type Row = { name: string; identifier: string; created: number }
let network: Row[] = []
let nextCreated = 1_000_000

function makeRow(index: number): Row {
  nextCreated += 1
  const id = `id${nextCreated}`
  const identifier =
    index % 10 === 0
      ? `_mail_qortal_qmail_alias_${nextCreated}_mail_${id}`
      : index % 10 === 1
      ? `_mail_qortal_qmail_me_${SUFFIX}_mail_${id}`
      : `_mail_qortal_qmail_other_name_${SUFFIX}_mail_${id}`
  return { name: `sender${index}`, identifier, created: nextCreated }
}

/** Builds `count` resources, oldest first, then stores them newest first. */
function buildNetwork(count: number) {
  const rows: Row[] = []
  for (let index = 0; index < count; index += 1) rows.push(makeRow(index))
  network = rows.reverse()
}

function addNewMail(count: number) {
  const rows: Row[] = []
  for (let index = 0; index < count; index += 1) rows.push(makeRow(index * 10))
  network = [...rows.reverse(), ...network]
}

const networkFetch = async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const params = new URLSearchParams(url.split('?')[1])
  const offset = Number(params.get('offset'))
  const limit = Number(params.get('limit'))
  return new Response(JSON.stringify(network.slice(offset, offset + limit)), { status: 200 })
}

const searchUrls = () => fetchedUrls('/arbitrary/resources/search')

const owned = new Set(['me'])

function makeRun(overrides: Partial<Parameters<typeof runAliasScanPass>[0]> = {}) {
  const inspected: string[] = []
  const run = () =>
    runAliasScanPass({
      checkpoint: readAliasScanCheckpointFromStorage(ADDRESS),
      seen: readAliasScanSeenFromStorage(ADDRESS),
      ownedNames: owned,
      search: (offset, limit) =>
        searchResources(aliasScanSearchParams(offset, limit), { ttlMs: ALIAS_SCAN_SEARCH_TTL_MS }),
      inspect: async (candidate: AliasScanCandidate) => {
        inspected.push(candidate.key)
        return null
      },
      onCheckpoint: (checkpoint, seen) => {
        writeAliasScanCheckpointToStorage(ADDRESS, checkpoint)
        writeAliasScanSeenToStorage(ADDRESS, seen)
      },
      ...overrides,
    })
  return { run, inspected }
}

describe('runAliasScanPass (N9)', () => {
  let original: ReturnType<typeof fetchMock.getMockImplementation>
  beforeEach(() => {
    resetSearchCache()
    nextCreated = 1_000_000
    original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(networkFetch)
  })
  afterEach(() => {
    if (original) fetchMock.mockImplementation(original)
  })

  it('reads at most 10 pages of 50 per run, newest first, with the original query', async () => {
    buildNetwork(1200)
    const { run, inspected } = makeRun()
    const result = await run()
    const urls = searchUrls()
    expect(urls).toHaveLength(10)
    urls.forEach((url, page) => {
      expect(url).toContain('limit=50')
      expect(url).toContain(`offset=${page * 50}&`)
      expect(url).toContain('query=qortal_qmail_')
      expect(url).toContain('reverse=true')
      expect(url).toContain('service=MAIL_PRIVATE')
    })
    expect(result.stoppedBy).toBe('cap')
    expect(result.resourcesWalked).toBe(500)
    expect(inspected).toHaveLength(50) // every 10th is alias mail
    expect(result.checkpoint.complete).toBe(false)
    expect(result.checkpoint.intervals).toEqual([
      { hi: network[0].created, lo: network[499].created, count: 500 },
    ])
    expect(readAliasScanCheckpointFromStorage(ADDRESS)?.intervals).toEqual(result.checkpoint.intervals)
  })

  it('"Scan more" continues where the last run stopped and reuses cached pages', async () => {
    buildNetwork(1200)
    const { run, inspected } = makeRun()
    await run()
    expect(searchUrls()).toHaveLength(10)

    fetchMock.mockClear()
    const second = await run()
    // Page 0 comes from the session cache, then offsets 500…900 from the node.
    expect(searchUrls().map(url => new URLSearchParams(url.split('?')[1]).get('offset'))).toEqual([
      '500', '550', '600', '650', '700', '750', '800', '850', '900',
    ])
    expect(second.stoppedBy).toBe('cap')
    expect(second.checkpoint.intervals).toEqual([
      { hi: network[0].created, lo: network[949].created, count: 950 },
    ])

    fetchMock.mockClear()
    const third = await run()
    expect(searchUrls()).toHaveLength(6) // 950…1150, then the empty page at 1200
    expect(third.stoppedBy).toBe('complete')
    expect(third.checkpoint.complete).toBe(true)
    expect(third.checkpoint.intervals).toHaveLength(1)
    expect(third.checkpoint.intervals[0].count).toBe(1200)

    expect(inspected).toHaveLength(120)
    expect(new Set(inspected).size).toBe(120)
  })

  it('a re-run of a finished scan in a new session costs one page and checks only new mail', async () => {
    buildNetwork(120)
    const { run, inspected } = makeRun({ maxPages: 10 })
    expect((await run()).stoppedBy).toBe('complete')
    const before = inspected.length

    resetSearchCache()
    addNewMail(3)
    fetchMock.mockClear()
    const result = await run()
    expect(searchUrls()).toHaveLength(1)
    expect(result.stoppedBy).toBe('complete')
    expect(inspected.length - before).toBe(3)
    expect(result.checkpoint.intervals).toEqual([
      { hi: network[0].created, lo: network[network.length - 1].created, count: 123 },
    ])
  })

  it('a re-run in the same session makes no searches at all', async () => {
    buildNetwork(80)
    const { run } = makeRun()
    await run()
    fetchMock.mockClear()
    await run()
    expect(searchUrls()).toHaveLength(0)
  })

  it('new mail above a half-finished scan is read first, then the older gap', async () => {
    buildNetwork(700)
    const { run, inspected } = makeRun()
    await run() // 0…499
    resetSearchCache()
    addNewMail(20)
    fetchMock.mockClear()
    const result = await run()
    // Offset 0 holds the 20 new rows, then the jump lands on 520 (= 20 + 500).
    const offsets = searchUrls().map(url => new URLSearchParams(url.split('?')[1]).get('offset'))
    expect(offsets.slice(0, 2)).toEqual(['0', '520'])
    expect(result.stoppedBy).toBe('complete')
    expect(result.checkpoint.intervals).toEqual([
      { hi: network[0].created, lo: network[719].created, count: 720 },
    ])
    expect(new Set(inspected).size).toBe(inspected.length)
    expect(inspected).toHaveLength(70 + 20)
  })

  it('never fetches a candidate twice, even when the checkpoint is lost', async () => {
    buildNetwork(200)
    const { run, inspected } = makeRun()
    await run()
    expect(inspected).toHaveLength(20)
    localStorage.removeItem(`qmail_alias_scan_checkpoint_${ADDRESS}`)
    resetSearchCache()
    await run()
    expect(inspected).toHaveLength(20)
  })

  it('reads a checkpoint of the old full scan as finished up to its time', async () => {
    buildNetwork(100)
    localStorage.setItem(
      `qmail_alias_scan_checkpoint_${ADDRESS}`,
      JSON.stringify({ lastProcessedTimestamp: network[30].created, lastProcessedIdentifier: 'x', updatedAt: 1 })
    )
    const legacy = readAliasScanCheckpointFromStorage(ADDRESS) as AliasScanCheckpoint
    expect(legacy.complete).toBe(true)
    expect(legacy.intervals).toEqual([{ hi: network[30].created, lo: 0, count: -1 }])
    const { run, inspected } = makeRun()
    const result = await run()
    expect(searchUrls()).toHaveLength(1)
    expect(result.stoppedBy).toBe('complete')
    // Rows 0…29 are newer than the checkpoint: alias mail at 0, 10, 20 (rows are built oldest first, so check by key).
    expect(inspected).toHaveLength(network.slice(0, 30).filter(row => row.identifier.includes('qmail_alias_')).length)
    expect(result.checkpoint.intervals).toEqual([{ hi: network[0].created, lo: 0, count: -1 }])
  })

  it('stops on cancel with a checkpoint that covers only what was walked', async () => {
    buildNetwork(300)
    let calls = 0
    const { run } = makeRun({
      isCancelled: () => calls >= 2,
      inspect: async () => {
        calls += 1
        return null
      },
    })
    const result = await run()
    expect(result.stoppedBy).toBe('cancel')
    expect(result.candidatesChecked).toBe(2)
    const [interval] = result.checkpoint.intervals
    expect(interval.hi).toBe(network[0].created)
    expect(interval.count).toBe(result.resourcesWalked)
    expect(network[interval.count - 1].created).toBe(interval.lo)
  })

  it('reports discovered aliases from decrypted bodies, skipping owned and known ones', async () => {
    network = [
      { name: 'a', identifier: '_mail_qortal_qmail_x_y_mail_1', created: 5 },
      { name: 'b', identifier: "_mail_qortal_qmail_MA's_mail_2", created: 4 },
      { name: 'c', identifier: '_mail_qortal_qmail_POS+_mail_3', created: 3 },
      { name: 'd', identifier: `_mail_qortal_qmail_a_b_${SUFFIX}_mail_4`, created: 2 },
    ]
    const { run, inspected } = makeRun({
      knownAliases: new Set(['pos+']),
      inspect: async candidate => {
        inspected.push(candidate.key)
        if (candidate.recipientHint === 'x_y') return { recipient: 'me' }
        if (candidate.recipientHint === "MA's") return { to: 'Shop Alias' }
        return {}
      },
    })
    const result = await run()
    expect(inspected).toEqual(['a|_mail_qortal_qmail_x_y_mail_1', "b|_mail_qortal_qmail_MA's_mail_2", 'c|_mail_qortal_qmail_POS+_mail_3'])
    expect(Array.from(result.discoveredAliases.values())).toEqual(['x_y', 'Shop Alias'])
  })
})

describe('alias scan helpers', () => {
  it('picks alias mail only, including aliases with "_"', () => {
    expect(toAliasScanCandidate({ name: 'n', identifier: '_mail_qortal_qmail_x_y_z_mail_1' }, owned)?.recipientHint).toBe('x_y_z')
    expect(toAliasScanCandidate({ name: 'n', identifier: `_mail_qortal_qmail_a_b_${SUFFIX}_mail_1` }, owned)).toBeNull()
    expect(toAliasScanCandidate({ name: 'n', identifier: '_mail_qortal_qmail_Me_mail_1' }, owned)).toBeNull()
    expect(toAliasScanCandidate({ name: 'n', identifier: 'qortal_qmail_thmsg_group1_t_u' }, owned)).toBeNull()
    expect(toAliasScanCandidate({ identifier: '_mail_qortal_qmail_x_mail_1' }, owned)).toBeNull()
  })

  it('reads recipient and to, falls back to the alias, and ignores failures', () => {
    expect(Array.from(aliasNamesFromBody({ recipient: 'Bob', to: 'me' }, 'hint', owned).values())).toEqual(['Bob'])
    expect(Array.from(aliasNamesFromBody({}, 'hint', owned).values())).toEqual(['hint'])
    expect(aliasNamesFromBody(null, 'hint', owned).size).toBe(0)
  })

  it('caps the remembered identifiers, keeping the newest', () => {
    writeAliasScanSeenToStorage(ADDRESS, ['a', 'b', 'c', 'd'], 3)
    expect(readAliasScanSeenFromStorage(ADDRESS)).toEqual(['b', 'c', 'd'])
  })

  it('drops broken intervals from storage', () => {
    localStorage.setItem(
      `qmail_alias_scan_checkpoint_${ADDRESS}`,
      JSON.stringify({ lastProcessedTimestamp: 9, intervals: [{ hi: 9, lo: 5, count: 3 }, { hi: 6, lo: 1, count: 2 }, { hi: 'x' }], complete: true })
    )
    expect(readAliasScanCheckpointFromStorage(ADDRESS)?.intervals).toEqual([{ hi: 9, lo: 5, count: 3 }])
  })

  it('labels the button for each state', () => {
    expect(aliasScanButtonLabel({ isRunning: true }, true)).toBe('Cancel scan')
    expect(aliasScanButtonLabel({ isRunning: true, isCancelRequested: true }, true)).toBe('Cancel requested')
    expect(aliasScanButtonLabel({ isRunning: false }, false)).toBe('Start alias scan')
    expect(aliasScanButtonLabel({ isRunning: false, complete: false }, true)).toBe('Scan more')
    expect(aliasScanButtonLabel({ isRunning: false, complete: true }, true)).toBe('Check new mail')
  })
})
