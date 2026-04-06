const CUSTOMER_EMAIL = 'tecnologia@bigzon.es';
const CUSTOMER_EMAIL_CC = 'soluciones@bigzon.es';

function generateHoursAndInvoice() {
  const schedulesData = buildSchedules();
  const currentMonthWorkingDays = countWorkingDays(schedulesData[0].schedule);
  const onCallWeeks = getOnCallWeeks(schedulesData[0].schedule);

  Logger.info(`Current month working days: ${currentMonthWorkingDays}`);
  Logger.info(`On call weeks: ${onCallWeeks}`);
  const invoicePdf = buildInvoice('BigZon', new Date(), currentMonthWorkingDays, onCallWeeks);

  const body = buildMailBody(schedulesData, onCallWeeks);
  const subject = buildSubject(schedulesData);

  createGmailDraft(body, subject, invoicePdf);
  
  sendNotification(subject);
}

/**
 * Cuenta el número de días con horas de trabajo registradas (hours > 0).
 *
 * @param {Array<Object>} schedules Un array de objetos, donde cada objeto representa un día.
 * @returns {number} El número total de días con horas mayores que cero.
 */
function countWorkingDays(schedules) {
  return schedules.filter(day => day.hours > 0).length;
}

/**
 * Extrae los periodos de guardia de un mes iterando sobre la propiedad 'isOnCall'.
 * Solo contabiliza la semana si el Lunes de dicha semana cae dentro del mes actual.
 * Si la semana termina en el mes siguiente, calcula el día correcto de fin (ej. 23 - 1).
 *
 * @param {Array<Object>} schedule El array de días de un mes concreto.
 * @return {Array<Object>} Un array de objetos con formato { from: number, to: number }.
 */
function getOnCallWeeks(schedule) {
  const onCallPeriods = [];
  let currentPeriodActive = false;
  let mondayDateStr = null;

  for (let i = 0; i < schedule.length; i++) {
    const day = schedule[i];

    if (day.isOnCall) {
      currentPeriodActive = true;
      // Si es Lunes, guardamos su fecha exacta como referencia para toda la semana
      if (day.dayName === 'L') {
        mondayDateStr = day.formattedDate; 
      }
    } else {
      // Si el día no es de guardia, cerramos y evaluamos el bloque anterior
      if (currentPeriodActive) {
        if (mondayDateStr) {
          onCallPeriods.push(calculateWeekRange(mondayDateStr));
        }
        currentPeriodActive = false;
        mondayDateStr = null;
      }
    }
  }

  // Si el mes termina en plena semana de guardia, evaluamos si guardarlo
  if (currentPeriodActive && mondayDateStr) {
    onCallPeriods.push(calculateWeekRange(mondayDateStr));
  }

  return onCallPeriods;
}

/**
 * Calcula el día de inicio (lunes) y fin (domingo) de una semana a partir de la fecha del lunes.
 * Maneja automáticamente los saltos al mes siguiente gracias al objeto Date de JavaScript.
 */
function calculateWeekRange(mondayDateStr) {
  // mondayDateStr tiene formato "dd/MM/yyyy"
  const parts = mondayDateStr.split('/');
  const day = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1; // En JS los meses van de 0 a 11
  const year = parseInt(parts[2], 10);

  const mondayDate = new Date(year, monthIndex, day);
  
  // Sumamos 6 días al lunes para obtener la fecha exacta del domingo de esa misma semana.
  // JS ajusta automáticamente el mes y el año si se pasa del límite.
  const sundayDate = new Date(year, monthIndex, day + 6);

  return {
    from: mondayDate.getDate(),
    to: sundayDate.getDate()
  };
}

function buildMailBody(schedulesData, onCallWeeks) {
  // Usamos .map() para crear una tabla HTML por cada mes en el array
  // y luego .join() para unirlas todas en un solo bloque de texto.
  const allMonthsHtml = schedulesData.map((monthData, index) => {
    const title = index === 0 ? "Resumen del mes actual" : "Previsión del mes";
    return buildHtmlSchedule(monthData.schedule, monthData.date, title);
  }).join('<br>'); // Añade un espacio entre cada tabla

  let onCallHtml = '';
  if (onCallWeeks.length > 0) {
    const listItems = onCallWeeks.map(period => `<li>Del ${period.from} al ${period.to}</li>`).join('');
    onCallHtml = `
      <p>Además, te dejo las semanas de guardias de este mes:</p>
      <ul>${listItems}</ul>
    `;
  } else {
    onCallHtml = `<p>Este mes no hay semanas de guardia programadas.</p>`;
  }

  const body = `
    <p>¡Buenas Julia!</p>
    <p>Te envío el resumen de horas del mes en curso y la previsión para los siguientes.</p>
    ${allMonthsHtml}
    ${onCallHtml}
    <p>Te adjunto la factura del mes actual, incluyendo las guardias.</p>
    <p>Recuerda que este correo está automatizado, así que cualquier cosa que no te cuadre... ¡avísame!</p>
    <p>Muchas gracias, ¡y un saludo!</p>
  `;

  return body;
}

function buildSubject(schedulesData) {
  const firstMonthName = schedulesData[0].date.toLocaleString('es-ES', { month: 'long' });

  // Si hay más de un mes, creamos un rango (ej: "septiembre a noviembre")
  if (schedulesData.length > 1) {
    const lastMonthName = schedulesData[schedulesData.length - 1].date.toLocaleString('es-ES', { month: 'long' });
    return `Previsión de horas: ${firstMonthName} a ${lastMonthName}`;
  }

  // Si solo hay un mes, solo mostramos ese.
  return `Previsión de horas - ${firstMonthName}`;
}

/**
 * Builds an HTML table string from the schedule data.
 * @param {Array<Object>} schedule - The array of day objects.
 * @param {Date} targetDate - A date within the target month for the title.
 * @param {string} title - The title for this specific table.
 * @return {string} The complete HTML string for one table.
 */
function buildHtmlSchedule(schedule, targetDate, title) {
  const monthName = targetDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  let totalHours = 0;
  let totalWorkingDays = 0;

  let tableRows = '';
  schedule.forEach(day => {
    const isNonWorking = day.hours === 0;
    if (!isNonWorking) totalWorkingDays++;
    totalHours += day.hours;
    const rowStyle = isNonWorking ? 'style="background-color: #f5f5f5; color: #888;"' : '';

    tableRows += `
      <tr ${rowStyle}>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><b>${day.formattedDate}</b></td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><b>${day.dayName}</b></td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${day.absenceReason}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${day.hours}</td>
      </tr>
    `;
  });

  return `
    <h3 style="font-family: sans-serif; color: #333; font-size: 1.5em">${title} - ${monthName}</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 450px; font-family: sans-serif; font-size: 14px;">
      <thead style="background-color: #256c71; color: white;">
        <tr>
          <th style="padding: 10px; text-align: center;">Fecha</th>
          <th style="padding: 10px; text-align: center;">Día</th>
          <th style="padding: 10px; text-align: center;">Ausencia</th>
          <th style="padding: 10px; text-align: center;">Horas</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot style="font-weight: bold; background-color: #7cc0c5;">
        <tr>
          <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;">Total días laborables:</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${totalWorkingDays} días</td>
        </tr>
        <tr>
          <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;">Total horas previstas:</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${totalHours} horas</td>
        </tr>
      </tfoot>
    </table>
  `;
}

/**
 * Creates the email draft in Gmail.
 */
function createGmailDraft(htmlBody, subject, invoice) {
  GmailApp.createDraft(CUSTOMER_EMAIL, subject, '', {
    htmlBody: htmlBody,
    cc: CUSTOMER_EMAIL_CC,
    attachments: [invoice]
  });
}

/**
 * Sends a notification email to the user.
 */
function sendNotification(emailSubject) {
  const userEmail = Session.getActiveUser().getEmail();
  const subject = `✅ Borrador para cliente listo: "${emailSubject}"`;
  const body = `El borrador con el resumen y previsión de horas está en tu carpeta de borradores de Gmail. Por favor, revísalo y envíalo.`;
  
  MailApp.sendEmail(userEmail, subject, body);
  Logger.log(`Draft created. Notification sent to ${userEmail}.`);
}
