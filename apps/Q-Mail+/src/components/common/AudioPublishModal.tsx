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
import { toBase64 } from '../../utils/toBase64'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { usePublishAudio } from './PublishAudio'

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

interface VideoModalProps {
  open: boolean
  onClose: () => void
  onPublish: (value: any) => void
}

interface SelectOption {
  id: string
  name: string
}

async function addAudioCoverImage(
  base64Audio: string,
  coverImageBase64: string
): Promise<string> {
  // Decode the base64 audio data
  const audioData: Uint8Array = new Uint8Array(
    atob(base64Audio)
      .split('')
      .map((char) => char.charCodeAt(0))
  )

  const decoder: TextDecoder = new TextDecoder('utf-8')
  const decodedAudioData: string = decoder.decode(audioData)

  // Create a Blob object from the decoded audio data
  const blob: Blob = new Blob([decodedAudioData], { type: 'audio/mpeg' })

  // Create a new file name for the audio with cover image
  const fileName: string = 'audio-with-cover.mp3'

  // Create a new FormData object to hold the file and metadata
  const formData: FormData = new FormData()
  formData.append('file', blob, fileName)

  // Create a new image object from the base64 data
  const image: HTMLImageElement = new Image()
  image.src = `data:image/png;base64,${coverImageBase64}`

  // Wait for the image to load before getting its dimensions
  await new Promise((resolve) => {
    image.onload = () => resolve(null)
  })

  // Get the image dimensions
  const width: number = image.width
  const height: number = image.height

  // Create a new metadata object with the image dimensions
  const metadata: any = {
    title: 'Audio with Cover',
    artist: 'Artist Name',
    album: 'Album Name',
    trackNumber: 1,
    image: {
      mime: 'image/png',
      type: 3,
      description: 'Cover Image',
      data: coverImageBase64,
      width: width,
      height: height
    }
  }

  // Set the metadata on the file
  formData.set('metadata', JSON.stringify(metadata))

  // Create a new URL object for the file
  const url: string = URL.createObjectURL(blob)

  // Create a download link for the file
  const link: HTMLAnchorElement = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()

  // Read the downloaded file and return its contents as a base64 string
  const fileReader: FileReader = new FileReader()
  fileReader.readAsDataURL(blob)
  return await new Promise<string>((resolve, reject) => {
    fileReader.onload = () => {
      const base64: string | undefined = fileReader.result?.toString()
      if (base64 !== undefined) {
        resolve(base64)
      } else {
        reject(new Error('Failed to read downloaded file.'))
      }
    }
    fileReader.onerror = () => reject(fileReader.error)
  })
}

export const AudioModal: React.FC<VideoModalProps> = ({
  open,
  onClose,
  onPublish
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
  const { publishAudio } = usePublishAudio()
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'audio/*': []
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0])
    }
  })

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
    const missingFields = []

    if (!title) missingFields.push('title')
    if (!file) missingFields.push('file')
    if (missingFields.length > 0) {
      const missingFieldsString = missingFields.join(', ')
      const errMsg = `Missing: ${missingFieldsString}`

      return
    }
    if (!file) return

    const formattedTags: { [key: string]: string } = {}
    chips.forEach((tag, i) => {
      formattedTags[`tag${i + 1}`] = tag
    })

    try {
      const base64 = await toBase64(file)
      if (typeof base64 !== 'string') return
      const base64String = base64.split(',')[1]

      const res = await publishAudio({
        title,
        description,
        base64: base64String,
        category: selectedOption?.id || '',
        ...formattedTags
      })
      onPublish(res)
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
    if (chips.length < 5) {
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
          Upload Audio
        </Typography>
        <Box
          {...getRootProps()}
          sx={{
            border: '1px dashed gray',
            padding: 2,
            textAlign: 'center',
            marginBottom: 2
          }}
        >
          <input {...getInputProps()} />
          <Typography>
            {file
              ? file.name
              : 'Drag and drop an audio file here or click to select a file'}
          </Typography>
        </Box>
        <TextField
          label="Audio Title"
          variant="outlined"
          fullWidth
          value={title}
          onChange={handleTitleChange}
          inputProps={{ maxLength: 40 }}
          sx={{ marginBottom: 2 }}
        />
        <TextField
          label="Audio Description"
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
