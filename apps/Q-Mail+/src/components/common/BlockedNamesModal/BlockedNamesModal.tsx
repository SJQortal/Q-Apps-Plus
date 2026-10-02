import React, { useState } from 'react'
import { Button, List, ListItem, ListItemText, Typography } from '@mui/material'
import { ResponsiveDialog } from '../ResponsiveDialog'
import { EmptyState, ErrorState, ListSkeleton } from '../../../layout/states'
import { errorMessage, isHubDecline, isPublicNodeRefusal } from '../../../utils/hubErrors'

interface PostModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Why the list could not be shown. Hub refuses GET/ADD/DELETE_LIST_ITEMS on a
 * public node (GO's default; Qortal-Hub get.ts getListItems), and a declined
 * "access list" dialog is the user's choice: neither is an error
 * (docs/QORTAL.md pitfalls 11 and 13). The inbox's own `excludeblocked`
 * searches go to Core directly and keep working either way.
 */
type Unavailable = 'public-node' | 'declined' | null

export const PUBLIC_NODE_TEXT = 'Not available on a public node'

/** Settings → Blocked names: the Qortal `blockedNames` list, with Remove per name. */
export const BlockedNamesModal: React.FC<PostModalProps> = ({ open, onClose }) => {
  const [blockedNames, setBlockedNames] = useState<string[] | null>(null)
  const [error, setError] = useState<string>('')
  const [unavailable, setUnavailable] = useState<Unavailable>(null)
  const [removing, setRemoving] = useState<string>('')

  const getBlockedNames = React.useCallback(async () => {
    setError('')
    setUnavailable(null)
    try {
      const response = await qortalRequest({
        action: 'GET_LIST_ITEMS',
        list_name: 'blockedNames'
      })
      setBlockedNames(Array.isArray(response) ? response : [])
    } catch (err: unknown) {
      setBlockedNames([])
      if (isPublicNodeRefusal(err)) setUnavailable('public-node')
      else if (isHubDecline(err)) setUnavailable('declined')
      else setError(errorMessage(err, 'Could not read the blocked names list'))
    }
  }, [])

  React.useEffect(() => {
    if (open) void getBlockedNames()
  }, [getBlockedNames, open])

  const removeFromBlockList = async (name: string) => {
    setRemoving(name)
    try {
      const response = await qortalRequest({
        action: 'DELETE_LIST_ITEM',
        list_name: 'blockedNames',
        item: name
      })
      if (response === true) {
        setBlockedNames((prev) => (prev || []).filter((n) => n !== name))
      }
    } catch (err: unknown) {
      // A decline keeps the name in the list quietly; a public node can't change lists at all.
      if (isPublicNodeRefusal(err)) setUnavailable('public-node')
      else if (!isHubDecline(err)) setError(errorMessage(err, `Could not unblock ${name}`))
    } finally {
      setRemoving('')
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Blocked names"
      maxWidth="xs"
      actions={
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Mail from these names is hidden everywhere in Qortal.
      </Typography>
      {blockedNames === null ? (
        <ListSkeleton rows={3} />
      ) : unavailable === 'public-node' ? (
        <Typography variant="body2" color="text.secondary" role="status" sx={{ py: 1 }}>
          {PUBLIC_NODE_TEXT}. Blocked names live on your own node; mail from names you blocked there stays hidden.
        </Typography>
      ) : unavailable === 'declined' ? (
        <EmptyState
          title="Access not granted"
          hint="Allow Q-Mail+ to read the list in Hub to see it here."
          action={
            <Button variant="outlined" color="inherit" onClick={() => void getBlockedNames()} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          }
        />
      ) : error && blockedNames.length === 0 ? (
        <ErrorState title="Could not load the list" message={error} onRetry={getBlockedNames} />
      ) : blockedNames.length === 0 ? (
        <EmptyState title="No blocked names" hint="Names you block from a message show up here." />
      ) : (
        <>
          {error && (
            <Typography variant="body2" color="error.main" role="alert" sx={{ mb: 1 }}>
              {error}
            </Typography>
          )}
          <List disablePadding sx={{ width: '100%' }}>
            {blockedNames.map((name) => (
              <ListItem
                key={name}
                disableGutters
                sx={{ minHeight: 48, gap: 1 }}
                secondaryAction={
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    disabled={removing === name}
                    onClick={() => removeFromBlockList(name)}
                    aria-label={`Unblock ${name}`}
                    sx={{ minHeight: 44 }}
                  >
                    Unblock
                  </Button>
                }
              >
                <ListItemText primary={name} slotProps={{ primary: { sx: { overflowWrap: 'anywhere', pr: 10 } } }} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </ResponsiveDialog>
  )
}
