import React, { useState } from 'react'
import {
  Box,
  Button,
  Modal,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  OutlinedInput,
  Chip,
  IconButton
} from '@mui/material'
import { styled } from '@mui/system'
import { useDropzone } from 'react-dropzone'
import { usePublishVideo } from './PublishVideo'
import { toBase64 } from '../../utils/toBase64'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
const StyledModal = styled(Modal)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}))

const ChipContainer = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  '& > *': {
    margin: '4px'
  }
})

const ModalContent = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(4),
  borderRadius: theme.spacing(1),
  width: '40%',
  '&:focus': {
    outline: 'none'
  }
}))

interface PostModalProps {
  open: boolean
  onClose: () => void
  onPublish: (value: any) => Promise<void>
  post: any
  mode?: string
  metadata?: any
}

interface SelectOption {
  id: string
  name: string
}

const PostPublishModal: React.FC<PostModalProps> = ({
  open,
  onClose,
  onPublish,
  post,
  mode,
  metadata
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    null
  )
  const [inputValue, setInputValue] = useState<string>('')
  const [chips, setChips] = useState<string[]>([])

  const [options, setOptions] = useState<SelectOption[]>([])
  const [tags, setTags] = useState<string[]>([])
  const { publishVideo } = usePublishVideo()
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'video/*': []
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0])
    }
  })

  React.useEffect(() => {
    if (post.title) {
      setTitle(post.title)
    }
    // if (post.description) {
    //   setDescription(post.description)
    // }
  }, [post])

  React.useEffect(() => {
    if (mode === 'edit' && metadata) {
      if (metadata.description) {
        setDescription(metadata.description)
      }

      const findCategory = options.find(
        (option) => option.id === metadata?.category
      )
      if (findCategory) {
        setSelectedOption(findCategory)
      }

      if (!metadata?.tags || !Array.isArray(metadata?.tags)) return

      setChips(metadata.tags.slice(0, -2))
    }
  }, [mode, metadata, options])

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value)
  }

  const handleDescriptionChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setDescription(event.target.value)
  }

  const handleOptionChange = (event: SelectChangeEvent<string>) => {
    const optionId = event.target.value
    const selectedOption = options.find((option) => option.id === optionId)
    setSelectedOption(selectedOption || null)
  }

  const handleChipDelete = (index: number) => {
    const newChips = [...chips]
    newChips.splice(index, 1)
    setChips(newChips)
  }

  const handleSubmit = async () => {
    const formattedTags: { [key: string]: string } = {}
    chips.forEach((tag, i) => {
      formattedTags[`tag${i + 1}`] = tag
    })

    try {
      await onPublish({
        title,
        description,
        tags: chips,
        category: selectedOption?.id || ''
      })
      setFile(null)
      setTitle('')
      setDescription('')
      onClose()
    } catch (error) {}
  }

  const handleInputChange = (event: any) => {
    setInputValue(event.target.value)
  }

  const handleInputKeyDown = (event: any) => {
    if (event.key === 'Enter' && inputValue !== '') {
      if (chips.length < 5) {
        setChips([...chips, inputValue])
        setInputValue('')
      } else {
        event.preventDefault()
      }
    }
  }

  const addChip = () => {
    if (chips.length < 3) {
      setChips([...chips, inputValue])
      setInputValue('')
    }
  }

  const getListCategories = React.useCallback(async () => {
    try {
      const url = `/arbitrary/categories`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      setOptions(responseData)
    } catch (error) {}
  }, [])

  React.useEffect(() => {
    getListCategories()
  }, [getListCategories])

  return (
    <StyledModal open={open} onClose={onClose}>
      <ModalContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Blog Post
        </Typography>

        <TextField
          label="Post Title"
          variant="outlined"
          fullWidth
          value={title}
          onChange={handleTitleChange}
          inputProps={{ maxLength: 40 }}
          sx={{ marginBottom: 2 }}
          disabled
        />
        <TextField
          label="Post Description"
          variant="outlined"
          fullWidth
          multiline
          rows={4}
          value={description}
          onChange={handleDescriptionChange}
          inputProps={{ maxLength: 180 }}
          sx={{ marginBottom: 2 }}
        />
        {options.length > 0 && (
          <FormControl fullWidth sx={{ marginBottom: 2 }}>
            <InputLabel id="Category">Select a Category</InputLabel>
            <Select
              labelId="Category"
              input={<OutlinedInput label="Select a Category" />}
              value={selectedOption?.id || ''}
              onChange={handleOptionChange}
            >
              {options.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl fullWidth sx={{ marginBottom: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <TextField
              label="Add a tag"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              disabled={chips.length === 3}
            />

            <IconButton onClick={addChip} disabled={chips.length === 3}>
              <AddIcon />
            </IconButton>
          </Box>
          <ChipContainer>
            {chips.map((chip, index) => (
              <Chip
                key={index}
                label={chip}
                onDelete={() => handleChipDelete(index)}
                deleteIcon={<CloseIcon />}
              />
            ))}
          </ChipContainer>
        </FormControl>
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Submit
        </Button>
      </ModalContent>
    </StyledModal>
  )
}

export default PostPublishModal
