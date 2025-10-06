# AU_OM Order Processing Application - Complete Flow Documentation

## Overview
This Node.js/Express application processes same-day delivery orders across Australian locations (Melbourne, Sydney, Perth, Adelaide, Brisbane). It integrates with multiple external services and follows a sequential processing pipeline.

## System Architecture

### Entry Point
- **File**: `index.js`
- **Port**: 8080 (configurable via PORT env var)
- **Route**: GET `/` (main processing endpoint)

---

## Request Processing Flow

### 1. Application Startup (`index.js`)

1. **Environment Setup**
   - Loads environment variables from `.env`
   - Configures database connection (MySQL via Cloud SQL proxy)
   - Sets up GoPeople API configuration
   - Initializes script configurations

2. **Middleware Setup**
   - CORS middleware (`corsMiddleware.js`)
   - Express JSON parsing

3. **Route Registration**
   - Registers main processing route via `OrderProcessingRoutes`

### 2. Request Reception (`routes/orderProcessingRoutes.js`)

**Entry**: GET request to `/`

**Parameters Expected**:
- `date` - Delivery date (YYYY-MM-DD format)
- `location` - Optional location filter
- `dev_mode` - Two-digit flag (e.g., "11")
  - First digit: Execute GoPeople API calls (1=yes, 0=no)
  - Second digit: Execute FOS updates (1=yes, 0=no)
- `source` - Optional source identifier (e.g., "zapier")

**Process**:
1. **Validation** (`utils/ValidationHelper.js`)
   - Validates and parses query parameters
   - Formats request parameters

2. **Pipeline Creation**
   - Creates `OrderProcessingPipeline` instance
   - Passes database config, GoPeople config, and scripts config

---

## Core Processing Pipeline (`services/OrderProcessingPipeline.js`)

### Phase 1: Database Connection & Batch Management

1. **Database Connection**
   - Connects to MySQL database via Cloud SQL proxy
   - Uses configuration from `.env` file

2. **Batch Number Retrieval** (`services/BatchManagementService.js`)
   - Connects to Google Firestore
   - Retrieves current batch numbers for all locations
   - Creates new batch entries if they don't exist

### Phase 2: Orders Script Execution

**Script**: `scripts/orders.js`
**Executor**: `services/ScriptExecutorService.js`

**Process**:
1. **SQL Query Execution**
   - Queries `shopify_orders` table with complex JOIN
   - Filters by delivery date, same-day orders, and location
   - Applies order prioritization (business > residential)

2. **Data Transformation**
   - Groups orders by location
   - Generates location summary (order counts per location)

3. **Batch Number Update**
   - Updates Firestore batch counters based on order counts
   - Increments batch numbers for locations with orders

4. **Order Tracking Initialization**
   - Creates tracking array with order details
   - Assigns batch numbers to each order

### Phase 3: GoPeople Logistics Processing

**Script**: `scripts/gopeople.js`
**API Service**: `services/GoPeopleApiService.js`

**Process** (if dev_mode[0] = '1'):
1. **Data Preparation**
   - Retrieves order details for GoPeople API
   - Applies cutoff time filtering using timezone logic
   - Builds API payloads with pickup/delivery addresses

2. **API Calls**
   - Makes HTTP POST requests to GoPeople API
   - Handles authentication via bearer token
   - Processes responses and error handling
   - Adds 100ms delay between calls to avoid rate limiting

3. **Result Processing**
   - Updates order tracking array with API results
   - Marks successful/failed orders
   - Updates batch numbers based on successful orders only

### Phase 4: Google Drive Folder Pre-creation

**Service**: `gdrive-service.js`

**Process**:
1. **Folder Structure Creation**
   - Creates delivery date folders
   - Creates location subfolders
   - Creates batch-specific folders
   - Only for orders that passed GoPeople validation

### Phase 5: Personalized Products Processing

**Script**: `scripts/personalized.js`

**Process**:
1. **Product Filtering**
   - Filters orders containing personalized products:
     - Personalized jars (`product:personalisedjar`)
     - Personalized candles (`product:personalisedcandle`)
     - Personalized plants (`product:personalisedplant`)
     - Personalized bottles (`product:personalisedbottle`)
     - Image uploads (`product:imageupload`)

2. **Data Processing**
   - Groups by location and product type
   - Extracts personalization properties using `PropertyExtractor`
   - Handles polaroid photo data
   - Adds batch information

### Phase 6: Packing & Message Processing

**Script**: `scripts/packing-message.js`

**Process**:
1. **Packing Slip Generation**
   - Creates packing slips for successful orders
   - Includes product details and quantities

2. **Message Card Processing**
   - Processes custom message cards
   - Handles personalization details

3. **Data Combination**
   - Combines personalized and packing data
   - Adds batch numbers and location information

### Phase 7: Polaroid Image Processing

**Service**: `gdrive-service.js`

**Process**:
1. **Image Upload**
   - Uploads polaroid images to Google Drive
   - Places images in pre-created folder structure
   - Handles multiple images per order

### Phase 8: FOS Status Update

**Script**: `scripts/FOS_update.js`

**Process** (if dev_mode[1] = '1'):
1. **Status Updates**
   - Updates order status in database
   - Marks orders as processed
   - Only updates orders that went through entire pipeline

---

## External Service Integrations

### 1. MySQL Database (Cloud SQL)
- **Connection**: Via Cloud SQL Proxy on port 3307
- **Tables**:
  - `shopify_orders` - Main order data
  - `shopify_order_additional_details` - Delivery preferences
  - `shopify_order_shipping` - Shipping addresses
  - `shopify_fulfillment_locations` - Location mappings
  - `shopify_order_products` - Product details
  - `shopify_products` - Product information

### 2. Google Firestore
- **Purpose**: Batch number management
- **Collection**: `batch_counters`
- **Document Format**: `{location}_{date}` (e.g., "Melbourne_2025-09-02")

### 3. GoPeople Logistics API
- **Endpoint**: `http://api-demo.gopeople.com.au/book/instant`
- **Authentication**: Bearer token
- **Purpose**: Same-day delivery booking

### 4. Google Drive API
- **Purpose**: File storage and folder management
- **Authentication**: Service account credentials
- **Structure**: Date/Location/Batch folders

---

## Configuration Management

### Environment Variables (`.env`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Database connection
- `GOPEOPLE_API_TOKEN`, `GOPEOPLE_API_URL` - GoPeople API settings
- `GOOGLE_APPLICATION_CREDENTIALS` - Google service account
- `GOOGLE_DRIVE_MAIN_FOLDER_ID` - Root folder ID

### Application Config (`config.js`)
- Location addresses and pickup schedules
- Timezone configurations
- GoPeople API payload defaults
- Pickup time rules and cutoff logic

---

## Data Flow Summary

```
HTTP Request → Validation → Pipeline Creation
    ↓
Database Connection + Batch Retrieval (Firestore)
    ↓
Orders Script (MySQL Query + Transform)
    ↓
Batch Number Update (Firestore)
    ↓
GoPeople Script + API Calls (if enabled)
    ↓
Batch Number Final Update (Firestore)
    ↓
Google Drive Folder Pre-creation
    ↓
Personalized Products Processing
    ↓
Packing/Message Processing
    ↓
Polaroid Image Upload (Google Drive)
    ↓
FOS Status Update (if enabled)
    ↓
Response Formation + Database Cleanup
```

## Error Handling

### Pipeline Level
- Database connection failures are caught and handled
- Individual script failures don't stop the entire pipeline
- Comprehensive error tracking in execution details

### Script Level
- SQL query failures are logged and returned
- Transformation errors are caught and handled
- Order tracking array maintains status for each order

### External Service Level
- API timeouts and failures are handled gracefully
- Firestore connection issues don't stop processing
- Google Drive operations have error recovery

## Response Format

The application returns a comprehensive JSON response containing:
- Overall execution status and timing
- Individual script execution details
- Order tracking array with status for each order
- Batch number information
- External service operation results
- Detailed error information (if any)

The response format can be customized for Zapier integration when `source=zapier` parameter is provided.