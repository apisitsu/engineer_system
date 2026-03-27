// ================================================================= //
//                         WEB APP & ROUTING                         //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Web Application Module
 * Handles all HTTP requests and routing
 */

/**
 * Main entry point for HTTP GET requests
 * @param {Object} e - Event object with URL parameters
 * @returns {HtmlOutput} HTML page output
 */
function doGet(e) {
  try {
    const webAppUrl = ScriptApp.getService().getUrl();
    const user = getUserInfo();

    // Block Guest users (users without roles)
    if (!user.roles || user.roles.length === 0) {
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Access Denied - Setup Data Sheet System</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
              font-size: 28px;
            }
            p {
              color: #666;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .email {
              background: #f5f5f5;
              padding: 10px;
              border-radius: 5px;
              font-family: monospace;
              color: #333;
              margin: 20px 0;
            }
            .contact-box {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 5px;
              padding: 15px;
              margin-top: 20px;
            }
            .contact-box strong {
              color: #856404;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">🔒</div>
            <h1>Access Denied</h1>
            <p>You do not have permission to access this system.</p>
            <div class="email">
              Logged in as: <strong>${user.email}</strong>
            </div>
            <div class="contact-box">
              <strong>⚠️ Need Access?</strong><br>
              Please contact Engineering team to request access.
            </div>
          </div>
        </body>
        </html>
      `).setTitle('Access Denied');
    }

    const userInfo = JSON.stringify(user);
    let template;
    let title = "Setup Data Sheet System";

    // Route to appropriate page based on URL parameter
    const page = e.parameter.page;
    switch (page) {
      case 'add':
        template = HtmlService.createTemplateFromFile('add-data');
        title = "Add New - Setup Data Sheet System";
        break;
      case 'edit':
        template = HtmlService.createTemplateFromFile('edit-data');
        title = "Edit - Setup Data Sheet System";
        // Pass parameters for edit functionality
        template.sheet = e.parameter.sheet || '';
        template.cn = e.parameter.cn || '';
        template.pcode = e.parameter.pcode || '';
        template.rev = e.parameter.rev || '';
        template.machine = e.parameter.machine || '';
        break;
      case 'pdf':
        // [NEW] Direct PDF Download
        return handleDirectPdfDownload(e.parameter);
      default:
        template = HtmlService.createTemplateFromFile('sds');
    }

    // Set template variables
    template.url = webAppUrl;
    template.userInfo = userInfo;
    template.searchTerm = e.parameter.search || '';
    template.autoload = e.parameter.autoload || 'false';

    return template.evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (err) {
    Logger.log(`doGet Error: ${err.message}`);
    return HtmlService.createHtmlOutput(`Error loading page: ${err.message}.`);
  }
}

/**
 * Include HTML partial files in main templates
 * @param {string} filename - Name of HTML file to include
 * @returns {string} HTML content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get template configuration for frontend
 * @returns {Object} Sheets configuration object
 */
function getTemplateConfig() {
  return SHEETS_CONFIG.search;
}

/**
 * [NEW] Handle direct PDF download from URL
 * Example URL: ?page=pdf&sheetName=VSG_tsg300znc&cn=310165&process_code=1021&rev=A&machine=VSG_tsg300znc
 * @param {Object} params - URL parameters
 * @returns {Blob|HtmlOutput} PDF blob or error page
 */
function handleDirectPdfDownload(params) {
  try {
    // Validate required parameters
    const requiredParams = ['sheetName', 'cn', 'process_code', 'rev', 'machine'];
    const missingParams = requiredParams.filter(param => !params[param]);

    if (missingParams.length > 0) {
      return createErrorPage(
        'Missing Parameters',
        `The following required parameters are missing: ${missingParams.join(', ')}`,
        'Please check the URL and include all required parameters.'
      );
    }

    // Log the request for debugging
    Logger.log(`[Direct PDF Download] CN=${params.cn}, Process=${params.process_code}, Rev=${params.rev}, Machine=${params.machine}`);

    // Prepare parameters for PDF export
    const pdfParams = {
      sheetName: params.sheetName,
      cn: params.cn,
      process_code: params.process_code,
      rev: params.rev || 'NC',
      machine: params.machine
    };

    // Call the existing PDF export function
    const result = exportSheetAsPdf(pdfParams);

    if (!result.success) {
      return createErrorPage(
        'PDF Generation Failed',
        result.error || 'Unknown error occurred',
        'Please verify that the document exists and you have permission to access it.'
      );
    }

    // Return auto-download HTML page with embedded PDF data
    return createAutoDownloadPage(result.pdfData, result.fileName);

  } catch (error) {
    Logger.log(`[Direct PDF Download] Error: ${error.message}`);
    return createErrorPage(
      'Server Error',
      error.message,
      'An unexpected error occurred while generating the PDF.'
    );
  }
}

/**
 * [NEW] Create error page for PDF download failures
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {string} suggestion - Suggestion for user
 * @returns {HtmlOutput} Error page
 */
function createErrorPage(title, message, suggestion) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Setup Data Sheet System</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          text-align: center;
          max-width: 600px;
          width: 100%;
        }
        .icon {
          font-size: 72px;
          margin-bottom: 20px;
          animation: shake 0.5s;
        }
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        h1 {
          color: #e74c3c;
          margin-bottom: 15px;
          font-size: 32px;
        }
        .error-message {
          background: #fee;
          border-left: 4px solid #e74c3c;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
        }
        .error-message strong {
          color: #c0392b;
          display: block;
          margin-bottom: 10px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .error-message p {
          color: #555;
          line-height: 1.6;
          margin: 0;
          font-family: monospace;
          font-size: 13px;
          background: white;
          padding: 10px;
          border-radius: 4px;
        }
        .suggestion {
          background: #e8f5e9;
          border-left: 4px solid #4caf50;
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          text-align: left;
        }
        .suggestion strong {
          color: #2e7d32;
          display: block;
          margin-bottom: 8px;
        }
        .suggestion p {
          color: #555;
          margin: 0;
          line-height: 1.6;
        }
        .back-button {
          display: inline-block;
          margin-top: 25px;
          padding: 12px 30px;
          background: #3498db;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          transition: background 0.3s;
        }
        .back-button:hover {
          background: #2980b9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>${title}</h1>

        <div class="error-message">
          <strong>Error Details:</strong>
          <p>${message}</p>
        </div>

        <div class="suggestion">
          <strong>💡 Suggestion:</strong>
          <p>${suggestion}</p>
        </div>

        <a href="javascript:history.back()" class="back-button">← Go Back</a>
      </div>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * [NEW] Create auto-download page for PDF
 * This page automatically triggers PDF download and shows a nice loading animation
 * @param {string} pdfData - Base64 encoded PDF data
 * @param {string} fileName - PDF file name
 * @returns {HtmlOutput} Auto-download page
 */
function createAutoDownloadPage(pdfData, fileName) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Downloading PDF - Setup Data Sheet</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 50px 40px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
          max-width: 500px;
          width: 100%;
        }
        .icon {
          font-size: 80px;
          margin-bottom: 20px;
          animation: bounce 1s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        h1 {
          color: #2c3e50;
          margin-bottom: 10px;
          font-size: 28px;
        }
        .filename {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          font-family: monospace;
          color: #495057;
          word-break: break-all;
          font-size: 14px;
        }
        .progress-bar {
          width: 100%;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
          margin: 30px 0;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          animation: progress 2s ease-in-out;
          border-radius: 3px;
        }
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .message {
          color: #6c757d;
          margin-top: 20px;
          font-size: 14px;
        }
        .success-message {
          color: #28a745;
          font-weight: 600;
          margin-top: 15px;
          display: none;
        }
        .manual-download {
          display: none;
          margin-top: 25px;
        }
        .manual-download button {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .manual-download button:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📄</div>
        <h1>Preparing Your PDF</h1>

        <div class="filename">
          <strong>File:</strong><br>
          ${fileName}
        </div>

        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>

        <div class="message" id="message">
          กำลังเตรียม PDF... กรุณารอสักครู่
        </div>

        <div class="success-message" id="successMessage">
          ✅ ดาวน์โหลดเรียบร้อย!
        </div>

        <div class="manual-download" id="manualDownload">
          <p style="color: #856404; margin-bottom: 15px;">
            ⚠️ หากไม่เริ่มดาวน์โหลดอัตโนมัติ กรุณากดปุ่มด้านล่าง
          </p>
          <button onclick="downloadPdf()">
            📥 Download PDF
          </button>
        </div>
      </div>

      <script>
        // PDF data (base64)
        const pdfData = '${pdfData}';
        const fileName = '${fileName}';

        function downloadPdf() {
          try {
            // Create download link
            const link = document.createElement('a');
            link.href = 'data:application/pdf;base64,' + pdfData;
            link.download = fileName;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success message
            document.getElementById('message').style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';

            // Optional: Close window after download (uncomment if needed)
            // setTimeout(() => window.close(), 3000);

          } catch (error) {
            console.error('Download error:', error);
            document.getElementById('message').textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
            document.getElementById('message').style.color = '#dc3545';
          }
        }

        // Auto-download on page load
        window.addEventListener('load', function() {
          setTimeout(function() {
            downloadPdf();

            // Show manual download button after 2 seconds
            setTimeout(function() {
              document.getElementById('manualDownload').style.display = 'block';
            }, 2000);
          }, 500);
        });
      </script>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html)
    .setTitle('Downloading PDF')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}