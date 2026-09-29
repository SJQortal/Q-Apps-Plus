import * as React from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { Avatar, Box } from '@mui/material'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { formatFullTimestamp } from '../../utils/time'
import AliasAvatar from '../../assets/svgs/AliasAvatar.svg'
import { AliasAvatarImg } from './Mail-styles'
const tableCellFontSize = '16px'

interface Data {
  name: string
  description: string
  createdAt: number
  user: string
  id: string
  tags: string[]
  subject?: string
}

interface ColumnData {
  dataKey: keyof Data
  label: string
  numeric?: boolean
  width?: number
}

const columns: ColumnData[] = [
  {
    label: 'Sender',
    dataKey: 'user',
    width: 200
  },
  {
    label: 'Subject',
    dataKey: 'description'
  },
  {
    label: 'Date',
    dataKey: 'createdAt',
    numeric: true,
    width: 200
  }
]



function fixedHeaderContent() {
  return (
    <TableRow>
      {columns.map((column) => {
        return (
          <TableCell
            key={column.dataKey}
            variant="head"
            align={column.numeric || false ? 'right' : 'left'}
            style={{ width: column.width }}
            sx={{
              backgroundColor: 'background.paper',
              fontSize: tableCellFontSize,
              padding: '7px'
            }}
          >
            {column.label}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

function rowContent(_index: number, row: Data, openMessage: any) {
  return (
    <React.Fragment>
      {columns.map((column) => {
        let subject = '-'
        if (column.dataKey === 'description' && row['subject']) {
          subject = row['subject']
        }
        return (
          <TableCell
            onClick={() => openMessage(row?.user, row?.id, row)}
            key={column.dataKey}
            align={column.numeric || false ? 'right' : 'left'}
            style={{ width: column.width, cursor: 'pointer' }}
            sx={{
              fontSize: tableCellFontSize,
              padding: '7px'
            }}
          >
            {column.dataKey === 'user' && (
              <Box
                sx={{
                  display: 'flex',
                  gap: '5px',
                  width: '100%',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                <AvatarWrapper user={row?.user}></AvatarWrapper>
                {row[column.dataKey]}
              </Box>
            )}
            {column.dataKey !== 'user' && (
              <>
                {column.dataKey === 'createdAt'
                  ? formatFullTimestamp(row[column.dataKey])
                  : column.dataKey === 'description'
                  ? subject
                  : row[column.dataKey]}
              </>
            )}
          </TableCell>
        )
      })}
    </React.Fragment>
  )
}

interface SimpleTableProps {
  openMessage: (user: string, messageIdentifier: string, content: any) => void
  data: Data[]
  children?: React.ReactNode
}

export default function SimpleTable({
  openMessage,
  data,
  children
}: SimpleTableProps) {
  return (
    <Paper style={{ width: '100%' }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>{fixedHeaderContent()}</TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index}>
                {rowContent(index, row, openMessage)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {children}
    </Paper>
  )
}

export const AvatarWrapper = ({ user, height , fallback, isAlias}: any) => {
  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  )
  const avatarLink = React.useMemo(() => {
    if (!user || !userAvatarHash) return ''
    const findUserAvatar = userAvatarHash[user]
    if (!findUserAvatar) return ''
    return findUserAvatar
  }, [userAvatarHash, user])

if(isAlias) return <AliasAvatarImg sx={{
  width: height,
  height: height
}}  src={AliasAvatar}/>
if(!fallback) return <Avatar  sx={{ width: height, height: height }} src={avatarLink} alt={user} />
  return <Avatar  sx={{ width: height, height: height }} src={avatarLink} alt={fallback} >{fallback?.charAt(0)}</Avatar>
}
