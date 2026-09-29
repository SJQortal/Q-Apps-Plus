import React, { useState } from "react";
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
} from "@mui/material";
import { styled } from "@mui/system";
import { useDropzone } from "react-dropzone";
import { usePublishVideo } from "./PublishVideo";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
const StyledModal = styled(Modal)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}));

const ChipContainer = styled(Box)({
  display: "flex",
  flexWrap: "wrap",
  "& > *": {
    margin: "4px"
  }
});

const ModalContent = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(4),
  borderRadius: theme.spacing(1),
  width: "40%",
  "&:focus": {
    outline: "none"
  }
}));

interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  onPublish: (value: any) => void;
  editVideoIdentifier?: string | null | undefined;
}

interface SelectOption {
  id: string;
  name: string;
}

const VideoModal: React.FC<VideoModalProps> = ({
  open,
  onClose,
  onPublish,
  editVideoIdentifier
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    null
  );
  const [inputValue, setInputValue] = useState<string>("");
  const [chips, setChips] = useState<string[]>([]);

  const [options, setOptions] = useState<SelectOption[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const { publishVideo } = usePublishVideo();
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "video/*": []
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0]);
    }
  });

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const handleDescriptionChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setDescription(event.target.value);
  };

  const handleOptionChange = (event: SelectChangeEvent<string>) => {
    const optionId = event.target.value;
    const selectedOption = options.find((option) => option.id === optionId);
    setSelectedOption(selectedOption || null);
  };

  const handleChipDelete = (index: number) => {
    const newChips = [...chips];
    newChips.splice(index, 1);
    setChips(newChips);
  };

  const handleSubmit = async () => {
    const missingFields = [];

    if (!title) missingFields.push("title");
    if (!file) missingFields.push("file");
    if (missingFields.length > 0) {
      const missingFieldsString = missingFields.join(", ");
      const errMsg = `Missing: ${missingFieldsString}`;

      return;
    }
    if (!file) return;

    const formattedTags: { [key: string]: string } = {};
    chips.forEach((tag, i) => {
      formattedTags[`tag${i + 1}`] = tag;
    });

    try {
      // const base64 = await toBase64(file)
      // if (typeof base64 !== 'string') return
      // const base64String = base64.split(',')[1]
      // if (!file) return

      const res = await publishVideo({
        file: file,
        editVideoIdentifier,
        title,
        description,
        category: selectedOption?.id || "",
        ...formattedTags
      });
      onPublish(res);
      setFile(null);
      setTitle("");
      setDescription("");
      onClose();
    } catch (error) {}
  };

  const handleInputChange = (event: any) => {
    setInputValue(event.target.value);
  };

  const handleInputKeyDown = (event: any) => {
    if (event.key === "Enter" && inputValue !== "") {
      if (chips.length < 5) {
        setChips([...chips, inputValue]);
        setInputValue("");
      } else {
        event.preventDefault();
      }
    }
  };

  const addChip = () => {
    if (chips.length < 5) {
      setChips([...chips, inputValue]);
      setInputValue("");
    }
  };

  const getListCategories = React.useCallback(async () => {
    try {
      const url = `/arbitrary/categories`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const responseData = await response.json();
      setOptions(responseData);
    } catch (error) {}
  }, []);

  React.useEffect(() => {
    getListCategories();
  }, [getListCategories]);

  return (
    <StyledModal open={open} onClose={onClose}>
      <ModalContent>
        {editVideoIdentifier && (
          <Typography variant="h6">
            You are editing: {editVideoIdentifier}
          </Typography>
        )}
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Video
        </Typography>
        <Box
          {...getRootProps()}
          sx={{
            border: "1px dashed gray",
            padding: 2,
            textAlign: "center",
            marginBottom: 2
          }}
        >
          <input {...getInputProps()} />
          <Typography>
            {file
              ? file.name
              : "Drag and drop a video file here or click to select a file"}
          </Typography>
        </Box>
        <TextField
          label="Video Title"
          variant="outlined"
          fullWidth
          value={title}
          onChange={handleTitleChange}
          inputProps={{ maxLength: 40 }}
          sx={{ marginBottom: 2 }}
        />
        <TextField
          label="Video Description"
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
              value={selectedOption?.id || ""}
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
          <Box sx={{ display: "flex", alignItems: "flex-end" }}>
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
  );
};

export default VideoModal;
