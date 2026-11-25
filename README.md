# CargoTrace — Global Shipment Visibility & Tracking Platform

**Live Website:** https://cargotrace-app.ethiodeploy.app/

CargoTrace is a web-based shipment management and tracking platform designed to help administrators, logistics operators, and customers manage orders, monitor shipments, and view shipment progress in one integrated system.

## Demo Website

Visit: https://cargotrace-app.ethiodeploy.app/

## Demo Login Credentials

The following demo accounts have been tested successfully against the hosted login API.

| Role | Email | Password |
|---|---|---|
| Administrator | admin@cargotrace.test | `password` |
| Logistics Operator | operator@cargotrace.test | `password` |
| Customer | customer@cargotrace.test | `password` |

**Note:** These credentials are for academic demonstration only. Do not use them for personal or sensitive information.

## Main Features

- **Dashboard:** Shipment statistics and operational overview.
- **Shipment Management:** Manage shipment records and details.
- **Shipment Tracking:** Monitor shipment status and tracking history.
- **Order Management:** Manage customer shipment orders.
- **Fleet Management:** Manage shipping companies and carriers.
- **Location Management:** Manage shipment origins and destinations.
- **Shipment Exceptions:** Record and manage shipment issues.
- **Notifications:** Receive shipment and system updates.
- **Audit Logs:** Record user activities.
- **User Management:** Role-based access for Administrators, Operators, and Customers.

## User Roles

| Role | Description |
|---|---|
| Administrator | Manages users and oversees platform operations. |
| Logistics Operator | Handles orders and shipment operations. |
| Customer | Creates and monitors personal shipment orders. |

## Technology Stack

| Technology | Purpose |
|---|---|
| Laravel 13 | Backend framework and REST API |
| PHP 8.3 | Backend programming language |
| MySQL | Relational database |
| HTML, CSS, JavaScript | Frontend interface |
| Composer | PHP dependency management |
| Node.js and NPM | Frontend asset management |
| Postman | API testing |

## Requirements

- PHP 8.3 or later
- Composer
- MySQL
- Node.js and NPM
- Git

## Local Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/nurul-aulia03/cargotrace-app.git
   ```

2. Open the project directory:

   ```bash
   cd cargotrace-app
   ```

3. Install PHP dependencies:

   ```bash
   composer install
   ```

4. Create the environment file:

   ```bash
   cp .env.example .env
   ```

5. Generate the application key:

   ```bash
   php artisan key:generate
   ```

6. Configure your database connection in the `.env` file.

7. Run database migrations:

   ```bash
   php artisan migrate
   ```

8. Install and build frontend assets:

   ```bash
   npm install
   npm run build
   ```

9. Start the local development server:

   ```bash
   php artisan serve
   ```

10. Open `http://127.0.0.1:8000` in your browser.

## API

Main authentication endpoints:

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/login` | User login |
| POST | `/api/register` | User registration |
| GET | `/api/user` | Get authenticated user |
| POST | `/api/logout` | User logout |

Protected endpoints require valid authentication.

## Testing

Run the automated test suite:

```bash
php artisan test
```

## Project Repository

GitHub: https://github.com/nurul-aulia03/cargotrace-app

## Developer

**CargoTrace — Academic Final Project**

© 2026 CargoTrace

