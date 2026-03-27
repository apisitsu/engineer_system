// ***********************************************
// Cypress Custom Commands for ECR/ECN Workflow
// ***********************************************

// Login command: sets localStorage to simulate authenticated user
Cypress.Commands.add('login', (userName = 'Admin User', role = 'AD') => {
    cy.window().then((win) => {
        win.localStorage.setItem('LOGIN_PASSED', 'true');
        win.localStorage.setItem('USER_NAME', userName);
        win.localStorage.setItem('ROLE', role);
        win.localStorage.setItem('USER_EMPNO', 'E001');
        win.localStorage.setItem('USER_DEPARTMENT', 'Admin');
        win.localStorage.setItem('USER_SECTION', 'IT');
    });
});

// Wait for Ant Design spinner to disappear
Cypress.Commands.add('waitForSpinner', () => {
    cy.get('.ant-spin-spinning', { timeout: 15000 }).should('not.exist');
});
