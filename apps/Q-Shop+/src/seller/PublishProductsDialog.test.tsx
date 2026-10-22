/**
 * The publish dialog on its own, with made-up resources: what goes to Hub in
 * which request. The flows around it (drafts, Redux) are in products.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { DATA_CONTAINER_ID, SELLER, SELLER_PK, SHORT_STORE_ID, encodeData64 } from "../test/fixtures/shop";
import { roomTiming } from "../qdn/publishBatches";
import { DELETED_DATA64, type PublishResource } from "../qdn/payloads";
import { resetQdnCaches } from "../qdn/search";
import { PublishProductsDialog, checkOnQdn } from "./PublishProductsDialog";

function resource(identifier: string): PublishResource {
  return { name: SELLER, service: "DOCUMENT", identifier, filename: "catalogue.json", data64: encodeData64({ id: identifier, products: {} }) };
}

const catalogueIds = (n: number) => Array.from({ length: n }, (_, i) => `q-store-catalogue-${SHORT_STORE_ID}-C${String(i).padStart(9, "0")}`);

/** Room on the account for every batch; nothing is served. */
function stubNode() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      if (url.startsWith("/transactions/unconfirmed")) return { ok: true, status: 200, text: async () => "[]" };
      if (url.startsWith("/transactions/unitfee")) return { ok: true, status: 200, text: async () => '"1000000"' };
      return { ok: false, status: 404, text: async () => '{"error":1401}' };
    })
  );
}

beforeEach(() => {
  resetQdnCaches();
  roomTiming.visibleMs = 5;
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomTiming.visibleMs = 10_000;
});

describe("PublishProductsDialog in batches", () => {
  it("never sends the product list with a catalogue that fails: it waits in a batch of its own", async () => {
    stubNode();
    // 24 catalogues and the index: before, the batches were [20] and [4 + index],
    // so a failing catalogue in the second request still let the index land.
    const ids = catalogueIds(24);
    const failing = ids[22];
    const resources = [...ids.map(resource), { ...resource(DATA_CONTAINER_ID), filename: "datacontainer.json" }];
    const q = installQortalMock({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async (p: any) => {
        if (p.resources.some((r: PublishResource) => r.identifier === failing)) {
          throw { error: { unsuccessfulPublishes: [{ identifier: failing }] } };
        }
        return true;
      },
    });
    const onDone = vi.fn();
    renderWithProviders(
      <PublishProductsDialog open resources={resources} labels={{}} publicKey={SELLER_PK} onDone={onDone} onClose={() => {}} />
    );
    const dialog = await screen.findByRole("dialog", { name: "Publish in 3 batches" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Start publishing" }));
    await screen.findByRole("button", { name: "Retry failed" }, { timeout: 4000 });

    const pubs = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(pubs.map((p) => p.resources.length)).toEqual([20, 4]);
    expect(pubs.flatMap((p) => p.resources.map((r: PublishResource) => r.identifier))).not.toContain(DATA_CONTAINER_ID);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("a retry sends the failed catalogue first and the product list after it, on its own", async () => {
    stubNode();
    const ids = catalogueIds(21);
    const resources = [...ids.map(resource), { ...resource(DATA_CONTAINER_ID), filename: "datacontainer.json" }];
    let first = true;
    const q = installQortalMock({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async (p: any) => {
        if (first) {
          first = false;
          throw { error: { unsuccessfulPublishes: [{ identifier: p.resources[0].identifier }] } };
        }
        return true;
      },
    });
    const onDone = vi.fn();
    renderWithProviders(
      <PublishProductsDialog open resources={resources} labels={{}} publicKey={SELLER_PK} onDone={onDone} onClose={() => {}} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry failed" }, { timeout: 4000 }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 4000 });
    const pubs = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(pubs.map((p) => p.resources.map((r: PublishResource) => r.identifier))).toEqual([
      ids.slice(0, 20),
      [ids[20]],
      [ids[0]],
      [DATA_CONTAINER_ID],
    ]);
  });
});

describe("PublishProductsDialog for a delete", () => {
  const deleted = (service: string, identifier: string): PublishResource => ({
    name: SELLER,
    service,
    identifier,
    data64: DELETED_DATA64,
    title: "deleted",
    description: "deleted",
    tags: ["deleted"],
  });

  it("sends the resources in the order given, in batches of 20, with a delete's words", async () => {
    stubNode();
    const resources = [deleted("STORE", "q-store-general-my-shop"), deleted("DOCUMENT", DATA_CONTAINER_ID), ...catalogueIds(23).map((id) => deleted("DOCUMENT", id))];
    const q = installQortalMock({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const onDone = vi.fn();
    renderWithProviders(
      <PublishProductsDialog
        open
        resources={resources}
        labels={{}}
        publicKey={SELLER_PK}
        onDone={onDone}
        onClose={() => {}}
        order="given"
        verb="delete"
        settledNote="Your shop stays hidden."
      />
    );
    const dialog = await screen.findByRole("dialog", { name: "Delete in 2 batches" });
    expect(within(dialog).queryByText(/Your product list goes last/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Start deleting" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 4000 });
    const pubs = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(pubs.map((p) => p.resources.map((r: PublishResource) => r.identifier))).toEqual([
      resources.slice(0, 20).map((r) => r.identifier),
      resources.slice(20).map((r) => r.identifier),
    ]);
    expect(pubs[0].resources[0]).toEqual(resources[0]);
  });

  it("checks a delete on QDN by the delete marker", async () => {
    const serve = (text: string) =>
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, status: 200, text: async () => text }))
      );
    serve("D");
    expect(await checkOnQdn(deleted("STORE", "q-store-general-a"))).toBe("done");
    serve(JSON.stringify({ title: "Still here" }));
    expect(await checkOnQdn(deleted("STORE", "q-store-general-b"))).toBe("missing");
    // A JSON publish whose resource reads as deleted isn't on QDN.
    serve("D");
    expect(await checkOnQdn(resource("q-store-catalogue-x-C1"))).toBe("missing");
  });
});
