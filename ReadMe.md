# Paulinian Electronic Archiving System (PeAS) [![License: CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc/4.0/)

PeAS is a digital repository developed for St. Paul University Dumaguete (SPUD). It centralizes the storage and accessibility of academic works, including theses, dissertations, confluences, and synergies, produced by the university's undergraduate and postgraduate students.

## Description

The Paulinian Electronic Archiving System (PeAS) is a web-based application designed to manage and provide access to academic documents. It features distinct user roles, comprehensive document management including compiled works, document categorization, robust search and filtering, and various functionalities for both end-users and administrators. The system aims to streamline the process of archiving, searching, retrieving, and managing academic works within St. Paul University Dumaguete.

## Key Features

* **Comprehensive Document Management**:
    * Secure storage and categorization of academic documents such as Thesis, Dissertation, Confluence, and Synergy.
    * Handles uploads, metadata extraction (including PDF metadata), editing, and archiving of single and compiled documents.
    * Supports soft deletion and potentially hard deletion of documents by administrators.
* **User Authentication, Roles, and Permissions**:
    * Secure login system using credentials and session tokens.
    * Distinct user roles (Admin, Registered User, Guest/Public) with differentiated access levels.
    * Granular permissions system for viewing, downloading, and managing documents.
* **Management of Compiled Works**:
    * Specific handling for compiled documents like "Confluence" and "Synergy" volumes.
    * Manages individual child documents within these compilations, including their authors and forewords for the parent volume.
* **Search and Discovery**:
    * Users can search for documents based on metadata such as title, abstract, author, and keywords.
    * Filtering by document type/category and sorting options are available.
* **User-Specific Features**:
    * Registered users have profiles for managing personal information.
    * Ability to save documents to a personal library ("Saved Documents").
    * Tracking of user document interaction history (views, downloads).
* **Document Access Request System**:
    * Formal mechanism for users to request access to non-public documents.
    * Admins review and approve/reject requests.
    * Email notifications for request status changes.
* **Administrative Functions**:
    * Dedicated admin dashboard for system overview and management.
    * Management of users, all documents, categories, authors, research agenda items, and system settings.
    * Viewing system logs, email activity logs, and site analytics (page visits, document views, downloads).
* **Tracking and Analytics**:
    * Logs page visits, author profile visits, document views, and downloads to provide insights into system usage.

## User Roles & Capabilities

The system provides different levels of access and functionality based on user roles:

* **Public Users (Guests)**:
    * Can view publicly accessible document information (titles, abstracts, metadata).
    * Can search and filter documents.
    * Can submit requests to access documents they cannot download directly.
* **Registered Users (e.g., Students, Faculty)**:
    * All capabilities of Public Users.
    * Can log in to the system.
    * Can download documents they have permission for (directly or after request approval).
    * Can save documents to their personal "User Library."
    * Have a user profile to manage their information and view their document interaction history.
* **Admin Users**:
    * All capabilities of Registered Users.
    * Full document management: Upload, edit metadata, manage files, archive, and delete documents (single and compiled).
    * User Management: Manage user accounts and roles.
    * Permission Management: Grant or revoke access permissions for documents.
    * Process Document Access Requests: Approve or reject user requests for documents.
    * System Monitoring: Access system logs, email logs, and analytics.

## Technologies Used

* **Backend**: Deno, TypeScript
* **Frontend**: HTML, CSS, JavaScript, Tailwind CSS
* **Database**: PostgreSQL
* **Email Service**: SMTP for sending notifications.
* **PDF Handling**: A service likely utilizing a library (e.g., pdf.js) for PDF metadata extraction.

## Project Structure

The repository is primarily organized as follows:

* **`Deno/`**: Contains the main backend and frontend application code.
    * **`api/`**: Backend API route handlers and some controller logic.
    * **`admin/`**: Admin-specific frontend components (HTML, CSS, JS) and pages.
    * **`Public/`**: Publicly accessible frontend assets, including HTML pages, CSS, JS, and images.
    * **`controllers/`**: Backend logic for handling requests and interacting with models/services.
    * **`db/`**: Database connection, schema (`peas_db.sql`), and migration files.
    * **`models/`**: Database table models defining data structures and interactions.
    * **`routes/`**: API route definitions.
    * **`services/`**: Business logic services (e.g., `emailService.ts`, `uploadService.ts`, `documentService.ts`).
    * **`utils/`**: Utility functions (e.g., `sessionUtils.ts`).
    * `server.ts`: Main Deno server application file.
    * `deps.ts`: Centralized Deno dependency management.
* **`storage/`**: Default directory for uploaded documents, categorized by type (e.g., `thesis`, `dissertation`, `confluence`, `synergy`, and `forewords`).
* **`logs/`**: Directory for application logs, including email activity.
* `.vscode/`: VS Code editor settings.
* `deno.json`: Deno task runner and configuration file.
* `package.json`, `package-lock.json`: Node.js package manager files, likely for frontend development tools like Tailwind CSS.

## Setup and Installation

1.  **Prerequisites**:
    * Deno runtime installed.
    * PostgreSQL database server.
    * Node.js and npm (for frontend dependencies like Tailwind CSS, if used for its compilation).
2.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd sPeAS 
    ```
3.  **Database Setup**:
    * Create a PostgreSQL database for PeAS.
    * Update database connection details. This is typically managed in `Deno/config/db.ts` or through environment variables referenced in `Deno/db/denopost_conn.ts`.
    * Run the database schema setup using `Deno/db/peas_db.sql` to create tables and relationships.
4.  **Environment Variables**:
    * Create a `.env` file in the `Deno/` directory.
    * Populate it with necessary variables such as `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, and `PORT` for the application. Refer to `Deno/server.ts` for environment variable usage.
5.  **Install Frontend Dependencies** (if `package.json` is actively used for managing frontend build tools):
    ```bash
    npm install
    ```
    (This might be needed for compiling Tailwind CSS or other frontend assets).
6.  **Run the application**:
    * Use the Deno tasks defined in `Deno/deno.json`:
        ```bash
        deno task dev  # For development, often includes --watch flag
        # or
        deno task start # For production
        ```
    * Alternatively, run the server directly (ensure necessary permissions are granted):
        ```bash
        deno run --allow-net --allow-read --allow-write --allow-env --unstable Deno/server.ts
        ```
        (The `--unstable` flag might be required depending on Deno features used).

## Usage

* **Public Users**: Access the application via the main URL (e.g., `http://localhost:PORT`). Browse and view publicly available documents. Submit requests for restricted documents.
* **Registered Users**: Log in via the `/log-in.html` page to access download features, save documents to a personal library, and view interaction history.
* **Admin Users**: Access the `/admin/dashboard.html` path for administrative functionalities, including document management, user management, viewing system logs, and managing document access requests.

## API Endpoints

The application exposes various API endpoints primarily under the `/api/` prefix. These handle functionalities such as:

* Document retrieval, upload, and management (e.g., `/api/documents`, `/api/compiled-documents`, `/api/upload`).
* User authentication and profile management (e.g., `/auth/login`, `/api/user/profile`).
* Data for authors, categories, research agenda, keywords.
* User library and history management (e.g., `/api/user/library`, `/api/user/history`).
* Document access requests.
* System statistics and reports.

For detailed endpoint definitions, refer to the route definitions in `Deno/routes/` and their registration in `Deno/server.ts`.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0). This was indicated in the original project `readme.md`.
You are free to:
* **Share** — copy and redistribute the material in any medium or format
* **Adapt** — remix, transform, and build upon the material
Under the following terms:
* **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
* **NonCommercial** — You may not use the material for commercial purposes.

See the [Creative Commons website](https://creativecommons.org/licenses/by-nc/4.0/) for full license details.