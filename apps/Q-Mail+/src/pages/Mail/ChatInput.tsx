import React, { useState } from 'react'
import { TextField, Button, Box } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'

export const ChatInput = ({ onSendMessage }: any) => {
  const [message, setMessage] = useState('')

  const handleInputChange = (e: any) => {
    setMessage(e.target.value)
  }

  const handleSendMessage = async () => {
    if (message.trim() !== '') {
      try {
        await onSendMessage(message)
        setMessage('')
      } catch (error) {}
    }
  }

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && message.trim() !== '') {
      handleSendMessage()
      e.preventDefault() // Prevents a newline in the TextField
    }
  }

  return (
    <Box
      component="form"
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px'
      }}
      onSubmit={(e) => {
        e.preventDefault()
        handleSendMessage()
      }}
    >
      <TextField
        variant="outlined"
        fullWidth
        value={message}
        onChange={handleInputChange}
        placeholder="Type a message..."
        multiline
        onKeyDown={handleKeyDown}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={message.trim() === ''}
        startIcon={<SendIcon />}
        sx={{ marginLeft: '8px' }}
      >
        Send
      </Button>
    </Box>
  )
}
