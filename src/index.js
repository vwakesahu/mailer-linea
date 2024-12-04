const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { ethers } = require("ethers");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// QR code directory setup
const QR_DIR = '/tmp/qr-codes';
if (!fs.existsSync(QR_DIR)) {
    fs.mkdirSync(QR_DIR, { recursive: true });
}

// Email transporter setup
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Blockchain setup
const contractABI = [
    {
        inputs: [
            {
                internalType: "bytes",
                name: "inputProof",
                type: "bytes",
            },
        ],
        name: "postInputProof",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    contractABI,
    wallet
);

// Email sending endpoint
app.post("/api/send-email", async (req, res) => {
    try {
        const { to, qrUrl = 'https://yourwebsite.com' } = req.body;

        if (!to) {
            return res.status(400).json({ error: "Missing recipient email" });
        }

        // Generate unique filename for QR code
        const qrFilename = `qr-${Date.now()}.png`;
        const qrPath = path.join(QR_DIR, qrFilename);

        // Generate QR code with good quality settings
        await QRCode.toFile(qrPath, qrUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 400,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject: "Welcome to Our Platform!",
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        .container {
                            max-width: 600px;
                            margin: auto;
                            padding: 20px;
                            font-family: Arial, sans-serif;
                            background-color: #ffffff;
                        }
                        .header {
                            background: #4F46E5;
                            color: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: 10px;
                            margin-bottom: 20px;
                        }
                        .content {
                            margin: 20px 0;
                            line-height: 1.6;
                            color: #333333;
                        }
                        .qr-section {
                            text-align: center;
                            margin: 20px 0;
                            padding: 20px;
                            background-color: #f8f9fa;
                            border-radius: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome! 🚀</h1>
                        </div>
                        <div class="content">
                            <p>Thank you for joining us!</p>
                            <div class="qr-section">
                                <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px;"/>
                                <p style="color: #666; margin-top: 10px;">Scan to access your dashboard</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            attachments: [{
                filename: 'qrcode.png',
                path: qrPath,
                cid: 'qrcode'  // Referenced in the HTML as cid:qrcode
            }]
        };

        const info = await transporter.sendMail(mailOptions);
        
        // Clean up: delete QR code file after sending
        fs.unlinkSync(qrPath);

        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Contract interaction endpoint
app.post("/contract/interact", async (req, res) => {
    try {
        const { handle, inputProof } = req.body;
        const txForPostingTheInputProof = await contract.postInputProof(
            inputProof,
            { gasLimit: 7000000 }
        );
        await txForPostingTheInputProof.wait();
        
        return res.json({
            success: true,
        });
    } catch (error) {
        console.error("Contract interaction error:", error);
        res.status(500).json({
            error: error.message,
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: "Something went wrong!",
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log("✉️ Email service initialized");
    console.log("⛓️ Contract interaction service initialized");
});
