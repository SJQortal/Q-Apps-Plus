import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Box, Typography } from "@mui/material";

export const AddressQRCode = ({ targetAddress }) => {
  return (
    <Box
      sx={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexDirection: "column",
        marginTop: '10px'
      }}
    >


     
        <Box
          sx={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: "10px",
              width: "100%",
              alignItems: "center",
              flexDirection: "column",
              marginTop: "20px",
            }}
          >
            <QRCode
              value={targetAddress} // Your address here
              size={150} // Adjust size as needed
              level="M" // Error correction level (L, M, Q, H)
              bgColor="#FFFFFF" // Background color (white)
              fgColor="#000000" // Foreground color (black)
            />
          </Box>
        </Box>
     
    </Box>
  );
};
