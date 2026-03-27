/// <reference types="cypress" />

describe('ECR/ECN Workflow E2E', () => {

    beforeEach(() => {
        // Simulate login by setting localStorage
        cy.visit('/eng/process_eng/ecnt/dashboard', {
            onBeforeLoad(win) {
                win.localStorage.setItem('LOGIN_PASSED', 'true');
                win.localStorage.setItem('USER_NAME', 'Admin User');
                win.localStorage.setItem('ROLE', 'AD');
                win.localStorage.setItem('USER_EMPNO', 'E001');
                win.localStorage.setItem('USER_DEPARTMENT', 'Admin');
                win.localStorage.setItem('USER_SECTION', 'IT');
            }
        });
        cy.waitForSpinner();
    });

    // =========================================================
    // Test 1: Create ECR Modal – Open, Dynamic Fields, Close
    // =========================================================
    describe('Test 1: Create ECR Modal & Dynamic Fields', () => {

        it('should open Create ECR modal when button is clicked', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');
            cy.get('.ant-modal-title').should('contain', 'Create New ECR');
        });

        it('should auto-fill user info fields', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Request By field should be auto-filled and disabled
            cy.get('#request_by').should('have.value', 'Admin User');
            cy.get('#request_by').should('be.disabled');

            // Department should be auto-filled
            cy.get('#department').should('have.value', 'Admin');
            cy.get('#department').should('be.disabled');
        });

        it('should show Drawing detail fields when Drawing checkbox is selected', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Initially, Drawing detail card should not exist
            cy.contains('Product/Process Drawing Change Details').should('not.exist');

            // Select Drawing checkbox
            cy.get('.ant-modal').contains('Product/Process Drawing').click();

            // Now Drawing detail card should be visible
            cy.contains('Product/Process Drawing Change Details').should('be.visible');
            cy.get('#part_no_drawing').should('be.visible');
            cy.get('#cn_drawing').should('be.visible');
            cy.get('#rev_drawing').should('be.visible');
        });

        it('should show Tooling/Program/Usage fields when Tooling checkbox is selected', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Initially, general details card should not exist
            cy.contains('General Details (Tooling/Program/Usage)').should('not.exist');

            // Select Tooling checkbox
            cy.get('.ant-modal').contains('Tooling').click();

            // General details and setup data sheet cards should appear
            cy.contains('General Details (Tooling/Program/Usage)').should('be.visible');
            cy.contains('Setup Data Sheet (Before & After)').should('be.visible');
            cy.contains('Cutting Program & Condition (Before & After)').should('be.visible');
        });

        it('should hide dynamic fields when checkbox is unselected', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Select then unselect Drawing
            cy.get('.ant-modal').contains('Product/Process Drawing').click();
            cy.contains('Product/Process Drawing Change Details').should('be.visible');

            cy.get('.ant-modal').contains('Product/Process Drawing').click();
            cy.contains('Product/Process Drawing Change Details').should('not.exist');
        });

        it('should show Other objective textarea when "Other" is selected', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Select "Other" objective
            cy.get('.ant-modal').contains('Other').click();
            cy.get('#objective_others').should('be.visible');
        });

        it('should close modal when Cancel is clicked', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            cy.get('.ant-modal').contains('button', 'Cancel').click();
            cy.get('.ant-modal').should('not.exist');
        });
    });

    // =========================================================
    // Test 2: Form Submission
    // =========================================================
    describe('Test 2: Form Submission', () => {

        it('should successfully submit a valid ECR form', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Fill Due Date
            cy.get('#due_date').click();
            cy.get('.ant-picker-dropdown').should('be.visible');
            // Click a future date – just pick the last available cell
            cy.get('.ant-picker-cell-inner').contains(/^28$/).first().click();

            // Select objective
            cy.get('.ant-modal').find('.ant-radio-wrapper').contains('Reduce cycle').click();

            // Select a change type
            cy.get('.ant-modal').find('.ant-checkbox-wrapper').contains('Product/Process Drawing').click();

            // Fill drawing details
            cy.get('#part_no_drawing').type('PN-001');
            cy.get('#cn_drawing').type('CN-001');
            cy.get('#rev_drawing').type('A');
            cy.get('#drawing_before_change').type('Old drawing spec');
            cy.get('#drawing_after_change').type('New drawing spec');

            // Intercept API call
            cy.intercept('POST', '**/api/ecr/create').as('createECR');

            // Submit
            cy.get('.ant-modal').contains('button', 'Submit Request').click();

            // Wait for API response
            cy.wait('@createECR').its('response.statusCode').should('eq', 200);

            // Verify success notification (Swal)
            cy.get('.swal2-popup').should('be.visible');
            cy.contains('ECR Created Successfully').should('be.visible');
        });
    });

    // =========================================================
    // Test 3: ECR Detail Modal & Workflow Actions
    // =========================================================
    describe('Test 3: ECR Detail Modal', () => {

        it('should open detail modal when clicking a table row', () => {
            // Wait for table data to load
            cy.get('.ant-table-tbody', { timeout: 10000 }).should('exist');
            cy.get('.ant-table-tbody tr').should('have.length.greaterThan', 0);

            // Click the first row
            cy.get('.ant-table-tbody tr').first().click();

            // Detail modal should open
            cy.get('.ant-modal').should('be.visible');
            cy.get('.ant-modal').should('contain', 'ECR Details');
        });

        it('should open detail modal when clicking Eye button', () => {
            cy.get('.ant-table-tbody', { timeout: 10000 }).should('exist');
            cy.get('.ant-table-tbody tr').should('have.length.greaterThan', 0);

            // Click the Eye icon on the first row
            cy.get('.ant-table-tbody tr').first().find('.anticon-eye').click();

            // Detail modal should open
            cy.get('.ant-modal').should('be.visible');
            cy.get('.ant-modal').should('contain', 'ECR Details');
        });

        it('should display ECR info and workflow sections in detail modal', () => {
            cy.get('.ant-table-tbody tr').first().click();
            cy.get('.ant-modal').should('be.visible');

            // Should show ECR Information card
            cy.get('.ant-modal').should('contain', 'ECR Information');
            cy.get('.ant-modal').should('contain', 'Request By:');
            cy.get('.ant-modal').should('contain', 'Department:');

            // Should show workflow section (Steps or ActionCard)
            cy.get('.ant-modal .ant-steps, .ant-modal .ant-card').should('exist');
        });

        it('should close detail modal when X is clicked', () => {
            cy.get('.ant-table-tbody tr').first().click();
            cy.get('.ant-modal').should('be.visible');

            cy.get('.ant-modal-close').click();
            cy.get('.ant-modal').should('not.exist');
        });
    });

    // =========================================================
    // Test 4: Validation & Error Handling
    // =========================================================
    describe('Test 4: Validation & Error Handling', () => {

        it('should show validation errors when submitting empty form', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Click submit without filling required fields
            cy.get('.ant-modal').contains('button', 'Submit Request').click();

            // Swal warning for missing fields should appear
            cy.get('.swal2-popup', { timeout: 5000 }).should('be.visible');
            cy.contains('Missing Fields').should('be.visible');
        });

        it('should not close modal on validation error', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            cy.get('.ant-modal').contains('button', 'Submit Request').click();

            // After clicking OK on Swal, modal should still be open
            cy.get('.swal2-popup .swal2-confirm', { timeout: 5000 }).click();
            cy.get('.ant-modal').should('be.visible');
        });

        it('should highlight required fields with error styling', () => {
            cy.contains('button', 'Create New ECR').click();
            cy.get('.ant-modal').should('be.visible');

            // Submit to trigger validation
            cy.get('.ant-modal').contains('button', 'Submit Request').click();
            cy.get('.swal2-popup .swal2-confirm', { timeout: 5000 }).click();

            // Ant Design form items with errors have ant-form-item-has-error class
            cy.get('.ant-modal .ant-form-item-has-error').should('have.length.greaterThan', 0);
        });
    });
});
