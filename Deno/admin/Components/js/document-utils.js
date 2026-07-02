/**
 * Document utilities module
 * This file contains utility functions for document handling
 */

// Document utilities object to be exported
window.documentUtils = {
    formatAuthors,
    formatDate,
    getCategoryIcon,
    formatCategoryName
};

/**
 * Format an array of authors into a readable string
 * @param {Array} authors - Array of author objects
 * @returns {string} - Formatted string of author names
 */
function formatAuthors(authors) {
    if (!authors || !Array.isArray(authors) || authors.length === 0) {
        return 'Unknown Author';
    }
    
    return authors
        .map(author => {
            if (typeof author === 'string') return author;
            return author.full_name || `${author.first_name || ''} ${author.last_name || ''}`.trim();
        })
        .filter(name => name) // Remove empty names
        .join(', ');
}

/**
 * Format a date string into a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown Date';
    
    try {
        return new Date(dateString).toLocaleDateString();
    } catch (error) {
        return 'Unknown Date';
    }
}

/**
 * Get the appropriate icon path for a category
 * @param {string} category - Category name
 * @returns {string} - Path to the category icon
 */
function getCategoryIcon(category) {
    const iconMap = {
        'THESIS': 'icons/category-icons/thesis.png',
        'Thesis': 'icons/category-icons/thesis.png',
        'DISSERTATION': 'icons/category-icons/dissertation.png',
        'Dissertation': 'icons/category-icons/dissertation.png',
        'CONFLUENCE': 'icons/category-icons/confluence.png',
        'Confluence': 'icons/category-icons/confluence.png',
        'SYNERGY': 'icons/category-icons/synergy.png',
        'Synergy': 'icons/category-icons/synergy.png'
    };
    
    return iconMap[category] || 'icons/category-icons/default_category_icon.png';
}

/**
 * Format a category name for display
 * @param {string} category - Category name from database
 * @returns {string} - Formatted category name for display
 */
function formatCategoryName(category) {
    // Default to 'Agenda' as requested
    return 'Agenda';
}
