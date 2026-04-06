/**
 * @fileoverview Script para Google Apps Script que automatiza el envío de facturas del mes anterior
 * a un gestor a través de correo electrónico.
 */

const MANAGER_EMAIL = 'info@insurebulgaria.com'; 
const INVOICES_FOLDER_ID = '1FKxwfcP4L55-B4OsRhX-w-6GWgJ3WOcg';

/**
 * Función principal que se ejecutará con el activador programado.
 * Orquesta el proceso de encontrar, adjuntar y enviar las facturas del mes anterior.
 *
 * @returns {void}
 */
function sendLastMonthInvoicesToManager() {
  Logger.log('Iniciando el proceso de envío de facturas del mes anterior...');

  // 1. Obtiene la fecha del mes anterior para buscar las facturas correctas.
  const lastMonthDate = getLastMonthDate();
  const lastMonthName = lastMonthDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  
  // 2. Busca los archivos PDF de las facturas en la carpeta de Drive.
  const invoiceFiles = findLastMonthInvoices(lastMonthDate);

  // 3. Si no encuentra facturas, registra un mensaje y termina la ejecución.
  if (invoiceFiles.length === 0) {
    Logger.log(`No se encontraron facturas para ${lastMonthName}. Proceso finalizado.`);
    return;
  }

  // 4. Prepara el cuerpo del correo electrónico con el resumen.
  const body = buildMailBody();
  
  // // 5. Prepara el asunto del correo.
  const subject = buildSubject(lastMonthDate);
  Logger.log(subject)

  // // 6. Crea el borrador del correo con las facturas adjuntas.
  createInvoicesDraft(body, subject, invoiceFiles);
  sendNotification(subject);

  Logger.log('Proceso de creación de borrador finalizado con éxito.');
}

/**
 * Obtiene un objeto Date para el primer día del mes anterior.
 *
 * @returns {Date} El objeto Date del mes anterior.
 */
function getLastMonthDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() - 1, 1);
}

/**
 * Encuentra los archivos de facturas del mes anterior en la carpeta de Google Drive.
 *
 * Asume que los nombres de los archivos tienen el formato 'YYYY_MM_...pdf',
 * lo que permite filtrar fácilmente.
 *
 * @param {Date} lastMonthDate El objeto Date del mes anterior.
 * @returns {File[]} Un array de objetos File de Google Drive.
 */
function findLastMonthInvoices(lastMonthDate) {
  const year = lastMonthDate.getFullYear().toString();
  const monthName = lastMonthDate.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
  const searchSuffix = `_${monthName}.pdf`;
  
  try {
    const parentFolder = findFolder(year);
    const files = parentFolder.getFiles();
    const invoiceFiles = [];
    
    // Itera sobre los resultados y los añade al array.
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      if (fileName.toLowerCase().endsWith(searchSuffix) && file.getMimeType() === MimeType.PDF) {
        invoiceFiles.push(file);
      }
    }
    
    Logger.log(`Se encontraron ${invoiceFiles.length} archivos que coinciden con el patrón: '${monthName}'`);
    return invoiceFiles;
  } catch (e) {
    Logger.log(`Error al buscar facturas: ${e.message}`);
    return [];
  }
}

/**
 * Busca o crea una carpeta para un año específico dentro de la carpeta principal.
 *
 * @param {string} year El año de la carpeta a buscar.
 * @returns {Folder} El objeto Folder de Google Drive correspondiente al año.
 */
function findFolder(year) {
  const parentFolder = DriveApp.getFolderById(INVOICES_FOLDER_ID);
  const currentYearFolder = parentFolder.getFoldersByName(year);
  return currentYearFolder.hasNext() ? currentYearFolder.next() : parentFolder.createFolder(year);
}


/**
 * Construye el cuerpo del correo electrónico en formato HTML.
 *
 * @param {string} monthName El nombre del mes anterior.
 * @returns {string} El cuerpo HTML del correo.
 */
function buildMailBody() {
  return `
    <p>Hi Hristo!</p>
    <p>Please, find attached the invoices for last month.</p>
    <p>This is also an automated email, so a response is only necessary if you find any discrepancies or have any queries.</p>
    <p>All the best!</p>
  `;
}

/**
 * Construye el asunto del correo electrónico.
 *
 * @param {string} monthName El nombre del mes anterior.
 * @returns {string} El asunto del correo.
 */
function buildSubject(date) {
  return `Invoices ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear().toString()}`;
}

/**
 * Crea un borrador de correo electrónico con las facturas adjuntas.
 *
 * @param {string} htmlBody El cuerpo HTML del correo.
 * @param {string} subject El asunto del correo.
 * @param {File[]} attachments Un array de objetos File de Google Drive.
 * @returns {void}
 */
function createInvoicesDraft(htmlBody, subject, attachments) {
  const invoiceBlobs = attachments.map(file => file.getBlob());
  
  // GmailApp es la clase principal; usamos createDraft en lugar de sendEmail.
  GmailApp.createDraft(MANAGER_EMAIL, subject, '', {
    htmlBody: htmlBody,
    attachments: invoiceBlobs,
  });

  Logger.log(`Borrador creado para ${MANAGER_EMAIL} con ${attachments.length} facturas adjuntas.`);
}

/**
 * Sends a notification email to the user.
 * @param {string} draftSubject El asunto del borrador, para ponerlo en la notificación.
 */
function sendNotification(draftSubject) {
  const userEmail = Session.getActiveUser().getEmail();
  const subject = `✅ Borrador de facturas listo: "${draftSubject}"`;
  const body = `El borrador con las facturas para Hristo ya está listo en tu carpeta de borradores de Gmail.\nPor favor, revísalo y envíalo cuando consideres oportuno.`;
  
  GmailApp.sendEmail(userEmail, subject, body);
  Logger.log(`Notification sent to ${userEmail}.`);
}
