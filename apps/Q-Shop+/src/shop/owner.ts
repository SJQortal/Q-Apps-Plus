/**
 * A shop named after its owner ("Biohackers Corner" by Biohackers Corner):
 * a "by …" line under its title would only say the name again (Simon's
 * phone, 2026-10-27), so it is left out.
 */
export function namedAfterOwner(title: string | null | undefined, owner: string | null | undefined): boolean {
  const plain = (text: string | null | undefined) => (text ?? "").trim().toLowerCase();
  return plain(owner) !== "" && plain(title) === plain(owner);
}
