/**
 * Run with: npm run seed
 * Creates one admin account and one personnel account per standard office
 * in the department, so you can log in and test the workflow immediately.
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const logger = require('./logger');

const OFFICES = ['Library', 'Bursary', 'Hostel', 'Head of Department', 'Sports Office', 'Faculty Dean', 'Director of Health'];

async function seed() {
  await connectDB();

  const adminEmail = 'hdm04740@gmail.com';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: 'System Administrator',
      email: adminEmail,
      password: 'Admin@12345',
      role: 'admin',
    });
    logger.info(`Seeded admin account: ${adminEmail} / Admin@12345`);
  } else {
    logger.info('Admin account already exists, skipping');
  }

  for (const office of OFFICES) {
    const email = `ahmadabdulwahab1216@gmail.com`;
    let emailrep;
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(true)
      // logger.info(`Personnel for ${office} already exists, skipping`);
      //edited from here to continue
      emailrep = `${office.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
      await User.create({
        name: `${office} Officer`,
        email: emailrep,
        password: `Personnel@12345`,
        role: 'personnel',
        officeName: office,
      });
      logger.info(`Seeded personnel account: ${email} / ${office.toLowerCase().replace(/\s+/g, '.')}@12345`);
      continue;
    }
    console.log(false)
    await User.create({
      name: `${office} Officer`,
      email,
      password: `${office.toLowerCase().replace(/\s+/g, '.')}@12345`,
      role: 'personnel',
      officeName: office,
    });
    // await User.create({
    //   name: `${office} Officer`,
    //   email: `${office.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
    //   password: `${office.toLowerCase().replace(/\s+/g, '.')}@12345`,
    //   role: 'personnel',
    //   officeName: office,
    // });
    logger.info(`Seeded personnel account: ${email} / ${office.toLowerCase().replace(/\s+/g, '.')}@12345`);
  }

  logger.info('Seeding complete');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seeding failed', err);
  process.exit(1);
});
