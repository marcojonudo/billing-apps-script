const HOURS_PER_DAY = 8;
const EXTRA_HOLIDAYS = [
  '2026-04-02' // Jueves Santo
];

const EXTRA_VACATIONS = [
  '2026-06-03', // Vacaciones
  '2026-06-08', // Vacaciones
  '2026-08-10', // Vacaciones
  '2026-08-11', // Vacaciones
  '2026-08-12', // Vacaciones
  '2026-08-13', // Vacaciones
  '2026-08-14', // Vacaciones
  '2026-08-15', // Vacaciones
  '2026-08-16', // Vacaciones
  '2026-08-17', // Vacaciones
  '2026-08-18', // Vacaciones
  '2026-08-19', // Vacaciones
  '2026-08-20', // Vacaciones
  '2026-08-21', // Vacaciones
  '2026-08-22'  // Vacaciones
];
// Fechas de inicio de las semanas de guardia (formato 'YYYY-MM-DD').
// Cada guardia tiene una duración de 7 días (una semana) a partir de la fecha indicada.
const ON_CALL_START_DATES = [
  '2026-06-15'
];

/**
 * Función principal mejorada. Genera los horarios para un número determinado de meses.
 * @param {Date} holidaysStart La fecha de inicio de las vacaciones.
 * @param {Date} holidaysEnd La fecha de fin de las vacaciones.
 * @param {number} [numberOfMonths=3] El número de meses a generar (por defecto, 3).
 * @return {Array<Object>|null} Un array de objetos, donde cada objeto contiene la fecha y el horario de un mes, o null si falla.
 */
function buildSchedules(holidaysStart, holidaysEnd, numberOfMonths = 3) {
  const today = new Date();
  const schedulesData = []; // Aquí guardaremos los resultados de cada mes.

  // 1. Bucle para iterar por el número de meses que necesitemos.
  for (let i = 0; i < numberOfMonths; i++) {
    // 2. Cálculo dinámico de la fecha para cada mes (actual, +1, +2, etc.).
    //    JavaScript maneja automáticamente el cambio de año (ej: mes 11 + 1 = mes 0 del año siguiente).
    const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);

    const schedule = generateMonthlySchedule(targetDate, holidaysStart, holidaysEnd);

    // 3. Verificación de errores en cada iteración.
    if (!schedule) {
      const monthName = targetDate.toLocaleString('es-ES', { month: 'long' });
      Logger.log(`No se pudo generar el horario para el mes de ${monthName}. Abortando.`);
      return null; // Si un mes falla, detenemos todo el proceso.
    }

    // 4. Añadimos el resultado al array.
    schedulesData.push({
      date: targetDate,
      schedule: schedule
    });
  }

  // 5. Devolvemos el array con todos los horarios generados.
  return schedulesData;
}

/**
 * Genera el calendario para un mes, teniendo en cuenta fines de semana, festivos y vacaciones.
 * @param {Date} targetDate - Una fecha dentro del mes a procesar.
 * @param {Date} holidaysStart - La fecha de inicio de las vacaciones.
 * @param {Date} holidaysEnd - La fecha de fin de las vacaciones.
 * @return {Array<Object>|null} Un array con los días del mes.
 */
function generateMonthlySchedule(targetDate, holidaysStart, holidaysEnd) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const holidaysSet = getPublicHolidays(year);

  if (!holidaysSet) return null;

  const schedule = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayShortNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  const defaultHoursPerDay = month == 7 ? 7 : HOURS_PER_DAY; // month 7 is August (0-indexed)

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();
    let hours = defaultHoursPerDay;
    let reason = '';
    const dateStringISO = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "dd/MM/yyyy");

    // Lógica para determinar si el día actual cae en una semana de guardia
    const currentUtcDate = Date.UTC(year, month, day);
    let isOnCall = false;
    for (const startDateStr of ON_CALL_START_DATES) {
      const parts = startDateStr.split('-');
      const startYear = parseInt(parts[0], 10);
      const startMonth = parseInt(parts[1], 10) - 1;
      const startDay = parseInt(parts[2], 10);
      const startUtcDate = Date.UTC(startYear, startMonth, startDay);
      
      const diffInDays = Math.floor((currentUtcDate - startUtcDate) / (1000 * 60 * 60 * 24));
      
      // Una guardia dura exactamente 1 semana (7 días)
      if (diffInDays >= 0 && diffInDays < 7) {
        isOnCall = true;
        break;
      }
    }

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      hours = 0;
      reason = 'Fin de semana';
    } else if (holidaysSet.has(dateStringISO)) {
      hours = 0;
      reason = 'Festivo';
    } else if (EXTRA_VACATIONS.includes(dateStringISO) || (holidaysStart && holidaysEnd && currentDate >= holidaysStart && currentDate <= holidaysEnd)) {
      // Esta condición solo se cumple si NO es fin de semana NI festivo.
      hours = 0;
      reason = 'Vacaciones';
    }

    schedule.push({
      formattedDate: formattedDate,
      dayName: dayShortNames[dayOfWeek],
      hours: hours,
      absenceReason: reason,
      isOnCall: isOnCall
    });
  }
  return schedule;
}

/**
 * Fetches national public holidays for a given year from the Nager.Date API.
 * @param {number} year - The year to fetch holidays for.
 * @return {Set<string>|null} A Set of holiday dates in 'YYYY-MM-DD' format, or null on failure.
 */
function getPublicHolidays(year) {
  const apiUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/ES`;
  const holidaysSet = new Set();

  EXTRA_HOLIDAYS.forEach(date => holidaysSet.add(date));

  try {
    const response = UrlFetchApp.fetch(apiUrl, { 'muteHttpExceptions': true });
    if (response.getResponseCode() === 200) {
      const holidaysData = JSON.parse(response.getContentText());
      holidaysData
        .filter(holiday => holiday.counties === null)
        .forEach(holiday => holidaysSet.add(holiday.date));
      return holidaysSet;
    } else {
      throw new Error(`API request failed with status code ${response.getResponseCode()}`);
    }
  } catch (e) {
    Logger.log(`Error fetching holiday data: ${e.message}`);
    return null;
  }
}

