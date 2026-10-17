/** A file kind's icon (rules/explorer/qdnFiles.ts FileKind). */
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import AudioFileOutlinedIcon from '@mui/icons-material/AudioFileOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DataObjectOutlinedIcon from '@mui/icons-material/DataObjectOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import type { SvgIconProps } from '@mui/material';
import type { FileKind } from '../../../../rules/explorer/qdnFiles';

const ICONS: Record<FileKind, typeof ImageOutlinedIcon> = {
  image: ImageOutlinedIcon,
  video: MovieOutlinedIcon,
  audio: AudioFileOutlinedIcon,
  pdf: PictureAsPdfOutlinedIcon,
  json: DataObjectOutlinedIcon,
  csv: TableChartOutlinedIcon,
  text: ArticleOutlinedIcon,
  html: CodeOutlinedIcon,
  zip: FolderZipOutlinedIcon,
  binary: InsertDriveFileOutlinedIcon,
};

export function FileKindIcon({ kind, ...props }: { kind: FileKind } & SvgIconProps) {
  const Icon = ICONS[kind];
  return <Icon fontSize="small" {...props} />;
}
