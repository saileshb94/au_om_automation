# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/Express order processing application for managing same-day delivery orders across multiple Australian locations (Melbourne, Sydney, Perth, Adelaide, Brisbane). The system integrates with MySQL database, GoPeople logistics API, Google Firestore for batch management, and Google Drive for file processing. This is a Google Could program setup on Google cloud and called via a api call. 

## Development Commands

**Running the application:**
- `npm start` - Start production server
- `npm run dev` - Start with nodemon for development

**Deployment:**
- `deploy.bat` - Deploy to Google Cloud Run
- `deploy-all.bat` - Push to GitHub and deploy to Cloud Run
- `git-push.bat` - Push changes to GitHub

**Environment check:**
- `setup-check.bat` - Verify Node.js, npm, gcloud, git installation and configuration

## Architecture

### Core Components

1. **Main Server** (`index.js`) - Express application that orchestrates the order processing pipeline
2. **Script Modules** - Individual processing modules:
   - `orders.js` - Primary order retrieval and filtering
   - `gopeople.js` - GoPeople logistics API integration
   - `personalized.js` - Personalized product processing
   - `packing-message.js` - Packing slip and message card generation
   - `FOS_update.js` - Final order status updates

### Configuration

- `config.js` - Centralized configuration for locations, timezones, pickup schedules, and API defaults
- `.env` - Environment variables (database credentials, API tokens, Google Drive settings)

### Processing Pipeline

The application follows a sequential processing pipeline:

1. **Orders Script** - Retrieves and filters orders, generates location summary
2. **Batch Management** - Updates Firestore batch counters per location
3. **GoPeople API** - Submits valid orders to logistics API (controlled by dev_mode flag)
4. **Folder Pre-creation** - Creates Google Drive folder structure for successful orders
5. **Personalized Processing** - Processes orders that passed GoPeople validation
6. **Packing/Message Processing** - Generates packing slips and message cards
7. **Polaroid Processing** - Uploads images to Google Drive
8. **FOS Update** - Updates order status in database (controlled by dev_mode flag)

### Key Features

- **Dev Mode Support** - Two-digit dev_mode parameter (e.g., "11") controls GoPeople API calls and FOS updates
- **Location-based Processing** - Different pickup schedules and addresses per Australian city
- **Batch Management** - Firestore-based batch numbering system
- **Order Tracking** - Comprehensive status tracking throughout pipeline
- **Cutoff Time Logic** - Automatic order filtering based on location-specific pickup schedules

### Database Schema

The application works with a MySQL database containing:
- `shopify_orders` - Main order table
- `shopify_order_additional_details` - Delivery details and preferences
- `shopify_order_shipping` - Shipping addresses
- `shopify_fulfillment_locations` - Location mappings

### External Integrations

- **GoPeople API** - Same-day delivery logistics
- **Google Firestore** - Batch counter persistence
- **Google Drive** - File storage and folder management
- **MySQL** - Primary data source

## Environment Requirements

- Node.js >= 16
- Google Cloud SDK (gcloud CLI)
- Access to MySQL database
- Google Drive API credentials
- GoPeople API token