# Paulinian Electronic Archiving System (PeAS) ![CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/88x31.png)

PeAS is a digital repository developed for St. Paul University Dumaguete (SPUD). It centralizes the storage and accessibility of academic works, including theses, dissertations, confluences, and synergies, produced by the university's undergraduate and postgraduate students.

## Description

The Paulinian Electronic Archiving System (PeAS) is a web-based application designed to manage and provide access to academic documents. It features distinct user roles, document categorization, and various functionalities for both users and administrators. The system aims to streamline the process of archiving, searching, and retrieving academic works.

## Features

-   **Centralized Repository**: Securely stores and categorizes academic documents such as theses, dissertations, confluences, and synergies by type, year, and metadata.
-   **User Roles**:
    -   **Public Users**: Can view documents but cannot download them.
    -   **Registered Users**: Can download documents, bookmark them, and track their document interactions.
    -   **Admin Users**: Manage documents, users, and system settings.
-   **Document Management**: Admins can upload, edit, and archive documents. This includes managing single documents and compiled collections.
-   **Search and Filtering**: Users can search for documents and filter them by various criteria including category, keywords, and year.
-   **User Authentication**: Secure login system for registered users and administrators.
-   **Document Access Requests**: A system for users to request access to documents.
-   **User Profiles**: Registered users have profiles where they can manage their information and saved documents.
-   **Activity Tracking**: The system logs various activities, including document views and downloads.
-   **Responsive UI**: The user interface includes components like a navigation bar, footer, and various interactive elements designed with Tailwind CSS.

## Technologies Used

-   **Backend**: Deno, TypeScript
-   **Frontend**: HTML, CSS, JavaScript, Tailwind CSS
-   **Database**: PostgreSQL (inferred from `denopost_conn.ts`)
-   **Email Service**: SMTP for sending notifications.
-   **PDF Handling**: pdf.js for PDF metadata extraction.

## Project Structure

The repository is organized as follows:

-   **`Deno/`**: Contains the main backend and frontend application code.
    -   **`api/`**: Backend API route handlers (e.g., `author.ts`, `document.ts`).
    -   **`admin/`**: Admin-specific frontend components and JavaScript.
        -   **`Components/`**: HTML, CSS, and JS for admin dashboard elements.
    -   **`Public/`**: Publicly accessible frontend assets.
        -   **`Components/`**: Reusable HTML, CSS, and JS components for the user-facing site (e.g., NavBar, footer).
        -   **`pages/`**: HTML pages for different user views (e.g., UserProfile, SavedDocument).
        -   `index.html`, `log-in.html`, etc.
    -   **`controllers/`**: Backend logic for handling requests (e.g., `documentController.ts`, `userController.ts`).
    -   **`db/`**: Database connection, schema, and migration files.
    -   **`models/`**: Database table models (e.g., `documentModel.ts`, `userModel.ts`).
    -   **`routes/`**: API route definitions.
    -   **`services/`**: Business logic services (e.g., `emailService.ts`, `uploadService.ts`).
    -   **`utils/`**: Utility functions.
    -   `server.ts`: Main Deno server application file.
    -   `deps.ts`: Centralized dependency management.
-   **`storage/`**: Default directory for uploaded documents, categorized by type (e.g., `thesis`, `dissertation`, `confluence`, `synergy`).
-   **`logs/`**: Directory for application logs, including email activity.
-   `.vscode/`: VS Code editor settings.
-   `deno.json`: Deno task runner and configuration file.
-   `package.json`, `package-lock.json`: Node.js package manager files, likely for frontend development tools like Tailwind CSS and Autoprefixer.

## Setup and Installation

1.  **Prerequisites**:
    * Deno runtime installed.
    * PostgreSQL database server.
    * Node.js and npm (for frontend dependencies if any).
2.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd sPeAS
    ```
3.  **Database Setup**:
    * Create a PostgreSQL database.
    * Update database connection details in `Deno/config/db.ts` or environment variables (refer to `Deno/db/denopost_conn.ts`).
    * Run database migrations located in `Deno/db/migrations/` to set up the schema (e.g., `peas_db.sql`).
4.  **Environment Variables**:
    * Create a `.env` file in the `Deno/` directory based on the requirements in `Deno/server.ts` (e.g., SMTP credentials, database configuration).
5.  **Install Frontend Dependencies** (if applicable, based on `package.json`):
    ```bash
    npm install
    ```
6.  **Run the application**:
    * Use the Deno tasks defined in `deno.json`:
        ```bash
        deno task dev  # For development with --watch flag
        # or
        deno task start # For production
        ```
    * Alternatively, run the server directly:
        ```bash
        deno run --allow-net --allow-read --allow-write --allow-env --unstable Deno/server.ts
        ```

## Usage

-   **Public Users**: Access the application via the main URL. Browse and view documents.
-   **Registered Users**: Log in to access download features, save documents to a personal library, and view history.
-   **Admin Users**: Access the `/admin/` path for administrative functionalities, including document and user management, viewing system logs, and managing document access requests.

## API Endpoints

The application exposes various API endpoints under `/api/` for functionalities such as:
-   Document retrieval, upload, and management (`/api/documents`, `/api/compiled-documents`, `/api/upload`)
-   User authentication and profile management (`/login`, `/api/user/profile`)
-   Author and category data (`/api/authors`, `/api/categories`)
-   Research agenda and keywords (`/api/research-agenda-items`, `/api/keywords`)
-   User library and history (`/api/user/library`, `/api/user/history`)
-   Document access requests (`/api/document-requests`)
-   System statistics and reports (`/api/page-visits/stats`, `/api/reports`)

(Refer to files in `Deno/routes/` and `Deno/api/` for detailed endpoint definitions.)

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).
You are free to:
* **Share** — copy and redistribute the material in any medium or format
* **Adapt** — remix, transform, and build upon the material
Under the following terms:
* **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
* **NonCommercial** — You may not use the material for commercial purposes.
See the [LICENSE.md](LICENSE.md) file or [Creative Commons website](https://creativecommons.org/licenses/by-nc/4.0/) for full license details.