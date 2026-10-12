import type { SvgIconProps } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AudiotrackOutlinedIcon from '@mui/icons-material/AudiotrackOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import type { AttachmentKind } from '../../utils/attachmentMeta';

/** One icon per attachment kind (MUI 9 outlined set). */
export function AttachmentIcon({ kind, ...props }: { kind: AttachmentKind } & SvgIconProps) {
  switch (kind) {
    case 'image':
      return <ImageOutlinedIcon {...props} />;
    case 'pdf':
      return <PictureAsPdfOutlinedIcon {...props} />;
    case 'text':
      return <DescriptionOutlinedIcon {...props} />;
    case 'audio':
      return <AudiotrackOutlinedIcon {...props} />;
    case 'video':
      return <VideocamOutlinedIcon {...props} />;
    case 'archive':
      return <FolderZipOutlinedIcon {...props} />;
    default:
      return <InsertDriveFileOutlinedIcon {...props} />;
  }
}
