import React, { useState } from 'react'
import { Button, List, ListItem, ListItemText, Typography } from '@mui/material'
import { ResponsiveDialog } from '../ResponsiveDialog'
import { EmptyState, ErrorState, ListSkeleton } from '../../../layout/states'

interface PostModalProps {
  open: boolean
  onClose: () => void
}

/** Settings → Blocked names: the Qortal `blockedNames` list, with Remove per name. */
export const BlockedNamesModal: React.FC<PostModalProps> = ({ open, onClose }) => {
  const [blockedNames, setBlockedNames] = useState<string[] | null>(null)
  const [error, setError] = useState<string>('')
  const [removing, setRemoving] = useState<string>('')

  const getBlockedNames = React.useCallback(async () => {
    setError('')
    try {
      const response = await qortalRequest({
        action: 'GET_LIST_ITEMS',
        list_name: 'blockedNames'
      })
      setBlockedNames(Array.isArray(response) ? response : [])
    } catch (err: any) {
      setBlockedNames([])
      setError(err?.message || 'Could not read the blocked names list')
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
    } catch {
      /* the name stays in the list; the user can try again */
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
      ) : error ? (
        <ErrorState title="Could not load the list" message={error} onRetry={getBlockedNames} />
      ) : blockedNames.length === 0 ? (
        <EmptyState title="No blocked names" hint="Names you block from a message show up here." />
      ) : (
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
      )}
    </ResponsiveDialog>
  )
}
