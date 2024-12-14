const nodemailer = require("nodemailer");
require("dotenv").config();

const sendMail = async (email,name,otp) => {
  try {
    let testAccount = await nodemailer.createTestAccount();

    let transporter = await nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure:true,
      auth: {
        user: "divikr4@gmail.com",
        pass: process.env.NODEMAILER_PASS
      },
    });


    let info = await transporter.sendMail({
      from: '"Divith " <divikr4@gmail.com>', 
      to: email,
      subject: `Hellow ${name} `,
      text:` Your OTP is: ${otp}`, 
      html: `<b>Your OTP is: ${otp}</b>`, 
    }); 
  } catch (error) {
    console.log('node mail error ',error)
    res.redirect('/userError')
  }
  
};

module.exports = sendMail;