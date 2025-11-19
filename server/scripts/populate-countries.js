/**
 * Countries Population Script
 *
 * One-time script to populate countries collection.
 * Run with: node scripts/populate-countries.js
 */

require('dotenv').config({ path: './.env' });
const { connect } = require('mongoose');
const { dbConnection } = require('../dist/db');
const { CountryModel } = require('../dist/models/country');

const countryData = [
  { name: 'Afghanistan', a2: 'AF', a3: 'AFG', region: 'Asia', subRegion: 'Southern Asia', currency: 'AFN', callCode: '+93' },
  { name: 'Albania', a2: 'AL', a3: 'ALB', region: 'Europe', subRegion: 'Southern Europe', currency: 'ALL', callCode: '+355' },
  { name: 'Algeria', a2: 'DZ', a3: 'DZA', region: 'Africa', subRegion: 'Northern Africa', currency: 'DZD', callCode: '+213' },
  { name: 'Argentina', a2: 'AR', a3: 'ARG', region: 'Americas', subRegion: 'South America', currency: 'ARS', callCode: '+54' },
  { name: 'Australia', a2: 'AU', a3: 'AUS', region: 'Oceania', subRegion: 'Australia and New Zealand', currency: 'AUD', callCode: '+61' },
  { name: 'Austria', a2: 'AT', a3: 'AUT', region: 'Europe', subRegion: 'Western Europe', currency: 'EUR', callCode: '+43' },
  { name: 'Bangladesh', a2: 'BD', a3: 'BGD', region: 'Asia', subRegion: 'Southern Asia', currency: 'BDT', callCode: '+880' },
  { name: 'Belgium', a2: 'BE', a3: 'BEL', region: 'Europe', subRegion: 'Western Europe', currency: 'EUR', callCode: '+32' },
  { name: 'Brazil', a2: 'BR', a3: 'BRA', region: 'Americas', subRegion: 'South America', currency: 'BRL', callCode: '+55' },
  { name: 'Canada', a2: 'CA', a3: 'CAN', region: 'Americas', subRegion: 'Northern America', currency: 'CAD', callCode: '+1' },
  { name: 'China', a2: 'CN', a3: 'CHN', region: 'Asia', subRegion: 'Eastern Asia', currency: 'CNY', callCode: '+86' },
  { name: 'Denmark', a2: 'DK', a3: 'DNK', region: 'Europe', subRegion: 'Northern Europe', currency: 'DKK', callCode: '+45' },
  { name: 'Egypt', a2: 'EG', a3: 'EGY', region: 'Africa', subRegion: 'Northern Africa', currency: 'EGP', callCode: '+20' },
  { name: 'Finland', a2: 'FI', a3: 'FIN', region: 'Europe', subRegion: 'Northern Europe', currency: 'EUR', callCode: '+358' },
  { name: 'France', a2: 'FR', a3: 'FRA', region: 'Europe', subRegion: 'Western Europe', currency: 'EUR', callCode: '+33' },
  { name: 'Germany', a2: 'DE', a3: 'DEU', region: 'Europe', subRegion: 'Western Europe', currency: 'EUR', callCode: '+49' },
  { name: 'Greece', a2: 'GR', a3: 'GRC', region: 'Europe', subRegion: 'Southern Europe', currency: 'EUR', callCode: '+30' },
  { name: 'India', a2: 'IN', a3: 'IND', region: 'Asia', subRegion: 'Southern Asia', currency: 'INR', callCode: '+91' },
  { name: 'Indonesia', a2: 'ID', a3: 'IDN', region: 'Asia', subRegion: 'South-Eastern Asia', currency: 'IDR', callCode: '+62' },
  { name: 'Ireland', a2: 'IE', a3: 'IRL', region: 'Europe', subRegion: 'Northern Europe', currency: 'EUR', callCode: '+353' },
  { name: 'Italy', a2: 'IT', a3: 'ITA', region: 'Europe', subRegion: 'Southern Europe', currency: 'EUR', callCode: '+39' },
  { name: 'Japan', a2: 'JP', a3: 'JPN', region: 'Asia', subRegion: 'Eastern Asia', currency: 'JPY', callCode: '+81' },
  { name: 'Jordan', a2: 'JO', a3: 'JOR', region: 'Asia', subRegion: 'Western Asia', currency: 'JOD', callCode: '+962' },
  { name: 'Kenya', a2: 'KE', a3: 'KEN', region: 'Africa', subRegion: 'Eastern Africa', currency: 'KES', callCode: '+254' },
  { name: 'Luxembourg', a2: 'LU', a3: 'LUX', region: 'Europe', subRegion: 'Western Europe', currency: 'EUR', callCode: '+352' },
  { name: 'Mexico', a2: 'MX', a3: 'MEX', region: 'Americas', subRegion: 'Central America', currency: 'MXN', callCode: '+52' },
  { name: 'Morocco', a2: 'MA', a3: 'MAR', region: 'Africa', subRegion: 'Northern Africa', currency: 'MAD', callCode: '+212' },
  { name: 'Netherlands', a2: 'NL', a3: 'NLD', region: 'Europe', subRegion: 'Western Europe', currency: 'EUR', callCode: '+31' },
  { name: 'New Zealand', a2: 'NZ', a3: 'NZL', region: 'Oceania', subRegion: 'Australia and New Zealand', currency: 'NZD', callCode: '+64' },
  { name: 'Norway', a2: 'NO', a3: 'NOR', region: 'Europe', subRegion: 'Northern Europe', currency: 'NOK', callCode: '+47' },
  { name: 'Pakistan', a2: 'PK', a3: 'PAK', region: 'Asia', subRegion: 'Southern Asia', currency: 'PKR', callCode: '+92' },
  { name: 'Philippines', a2: 'PH', a3: 'PHL', region: 'Asia', subRegion: 'South-Eastern Asia', currency: 'PHP', callCode: '+63' },
  { name: 'Poland', a2: 'PL', a3: 'POL', region: 'Europe', subRegion: 'Eastern Europe', currency: 'PLN', callCode: '+48' },
  { name: 'Portugal', a2: 'PT', a3: 'PRT', region: 'Europe', subRegion: 'Southern Europe', currency: 'EUR', callCode: '+351' },
  { name: 'Russia', a2: 'RU', a3: 'RUS', region: 'Europe', subRegion: 'Eastern Europe', currency: 'RUB', callCode: '+7' },
  { name: 'Saudi Arabia', a2: 'SA', a3: 'SAU', region: 'Asia', subRegion: 'Western Asia', currency: 'SAR', callCode: '+966' },
  { name: 'South Africa', a2: 'ZA', a3: 'ZAF', region: 'Africa', subRegion: 'Southern Africa', currency: 'ZAR', callCode: '+27' },
  { name: 'South Korea', a2: 'KR', a3: 'KOR', region: 'Asia', subRegion: 'Eastern Asia', currency: 'KRW', callCode: '+82' },
  { name: 'Spain', a2: 'ES', a3: 'ESP', region: 'Europe', subRegion: 'Southern Europe', currency: 'EUR', callCode: '+34' },
  { name: 'Sweden', a2: 'SE', a3: 'SWE', region: 'Europe', subRegion: 'Northern Europe', currency: 'SEK', callCode: '+46' },
  { name: 'Switzerland', a2: 'CH', a3: 'CHE', region: 'Europe', subRegion: 'Western Europe', currency: 'CHF', callCode: '+41' },
  { name: 'Thailand', a2: 'TH', a3: 'THA', region: 'Asia', subRegion: 'South-Eastern Asia', currency: 'THB', callCode: '+66' },
  { name: 'Turkey', a2: 'TR', a3: 'TUR', region: 'Asia', subRegion: 'Western Asia', currency: 'TRY', callCode: '+90' },
  { name: 'Ukraine', a2: 'UA', a3: 'UKR', region: 'Europe', subRegion: 'Eastern Europe', currency: 'UAH', callCode: '+380' },
  { name: 'United Arab Emirates', a2: 'AE', a3: 'ARE', region: 'Asia', subRegion: 'Western Asia', currency: 'AED', callCode: '+971' },
  { name: 'United Kingdom', a2: 'GB', a3: 'GBR', region: 'Europe', subRegion: 'Northern Europe', currency: 'GBP', callCode: '+44' },
  { name: 'United States', a2: 'US', a3: 'USA', region: 'Americas', subRegion: 'Northern America', currency: 'USD', callCode: '+1' },
  { name: 'Vietnam', a2: 'VN', a3: 'VNM', region: 'Asia', subRegion: 'South-Eastern Asia', currency: 'VND', callCode: '+84' },
];

class CountryPopulator {
  async connect() {
    console.log('🔌 Connecting to MongoDB...');
    await connect(dbConnection.url, dbConnection.options);
    console.log('✅ Connected to MongoDB');
  }

  async populateCountries() {
    console.log('🌍 Populating countries...');

    const existing = await CountryModel.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  Countries already populated (${existing} found). Skipping...`);
      return;
    }

    const result = await CountryModel.insertMany(countryData);
    console.log(`✅ Inserted ${result.length} countries`);
  }

  async run() {
    try {
      await this.connect();
      await this.populateCountries();
      console.log('✅ Countries populated successfully!');
    } catch (error) {
      console.error('💥 Population script failed:', error);
      process.exit(1);
    }
  }
}

// Run the population script
if (require.main === module) {
  const populator = new CountryPopulator();
  populator.run().catch(console.error);
}

module.exports = { CountryPopulator };
