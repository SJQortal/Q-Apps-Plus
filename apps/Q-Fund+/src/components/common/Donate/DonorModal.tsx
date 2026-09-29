import {
  Button,
  Modal,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { ModalBody } from "../../Crowdfund/Crowdfund-styles";
import Box from "@mui/material/Box";
import { ViewableDonorData } from "./DonorInfo";
import { truncateNumber } from "qortal-app-utils";

interface DonorModalProps {
  donorData: ViewableDonorData[];
  closeModal: () => void;
  open: boolean;
}

const DonorModal = ({ donorData, closeModal, open }: DonorModalProps) => {
  const getAverageDonation = () => {
    const donorCount = donorData.length;
    if (donorCount === 0) return 0;
    let donorSum = 0;
    donorData.map(data => {
      donorSum += Number(data.amount);
    });
    const average = donorSum / donorCount;
    return truncateNumber(average, 2);
  };

  return (
    <Modal
      open={open}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      onClose={closeModal}
    >
      <ModalBody>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TableContainer sx={{ maxHeight: "300px" }}>
            <Table align="center" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {donorData.map((donorData, index) => (
                  <TableRow key={donorData.address + index.toString()}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{donorData.nameIfExists}</TableCell>
                    <TableCell>{donorData.amount}</TableCell>
                    <TableCell>{donorData.address}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        <Stack>
          <h4>Total # of Donations: {donorData.length}</h4>
          <h4>Average Donation Amount: {getAverageDonation()}</h4>
        </Stack>
        <Button onClick={closeModal}>Close</Button>
      </ModalBody>
    </Modal>
  );
};
export default DonorModal;
