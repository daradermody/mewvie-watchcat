const nodemailer = require('nodemailer');
const fs = require('fs');
const pug = require('pug');

class AuthInfo {
  constructor(username, password) {
    this.user = username;
    this.pass = password;
  }
}

class Emailer {
  static sendMail(destinationEmail, subject, template, data) {
    return new Promise((resolve, reject) => {
      const mailOptions = {
        from: 'OverDB',
        to: destinationEmail,
        subject: subject,
        html: pug.renderFile(__dirname + '/templates/' + template, data)
      };

      Emailer.transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error);
        } else {
          resolve(info.messageId);
        }
      });
    });
  }

  static getAuthInformation() {
    const emailAuthFile = __dirname + '/email_auth.json';

    if (!fs.existsSync(emailAuthFile)) {
      const authInfo = new AuthInfo('daradermody@outlook.com', '[password]');
      fs.writeFileSync(emailAuthFile, JSON.stringify(authInfo, null, 2));
    }

    const authInformation = JSON.parse(fs.readFileSync(emailAuthFile, 'utf8'));

    if (authInformation.pass === '[password]') {
      throw new Error(`Update the password here: ${emailAuthFile}`);
    }

    return authInformation;
  }
}

Emailer.authInfo = Emailer.getAuthInformation();

Emailer.transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com",
  secure: false,
  port: 587,
  auth: Emailer.authInfo
});


module.exports = Emailer;