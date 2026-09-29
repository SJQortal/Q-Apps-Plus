import React, { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Modal,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  OutlinedInput,
  Chip,
  IconButton
} from '@mui/material'
import { useDispatch } from 'react-redux'
import { togglePublishBlogModal } from '../../state/features/globalSlice'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { styled } from '@mui/system'
interface SelectOption {
  id: string
  name: string
}
interface MyModalProps {
  open: boolean
  onClose: () => void
  onPublish: (
    title: string,
    description: string,
    category: string,
    tags: string[]
  ) => Promise<void>
  currentBlog: any
}

const ChipContainer = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  '& > *': {
    margin: '4px'
  }
})

const MyModal: React.FC<MyModalProps> = ({
  open,
  onClose,
  onPublish,
  currentBlog
}) => {
  const dispatch = useDispatch()

  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    null
  )
  const [inputValue, setInputValue] = useState<string>('')
  const [chips, setChips] = useState<string[]>([])

  const [options, setOptions] = useState<SelectOption[]>([])
  React.useEffect(() => {
    if (currentBlog) {
      setTitle(currentBlog?.title || '')
      setDescription(currentBlog?.description || '')
      const findCategory = options.find(
        (option) => option.id === currentBlog?.category
      )
      if (!findCategory) return
      setSelectedOption(findCategory)
      if (!currentBlog?.tags || !Array.isArray(currentBlog.tags)) return
      setChips(currentBlog.tags)
    }
  }, [currentBlog, options])

  const handlePublish = async (): Promise<void> => {
    try {
      await onPublish(title, description, selectedOption?.id || '', chips)
      handleClose()
    } catch (error: any) {
      setErrorMessage(error.message)
    }
  }

  const handleClose = (): void => {
    setErrorMessage('')
    dispatch(togglePublishBlogModal(false))
    onClose()
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
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography id="modal-title" variant="h6" component="h2">
          Edit Blog
        </Typography>
        <TextField
          id="modal-title-input"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
        />
        <TextField
          id="modal-description-input"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={4}
          fullWidth
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
        {errorMessage && (
          <Typography color="error" variant="body1">
            {errorMessage}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" color="error" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="contained" color="success" onClick={handlePublish}>
            Publish
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}

export default MyModal
