const INVOICE_TEMPLATE_SPREADSHEET_ID = '19Hgm1OpBoyoUSviI57TdZo1ydYufiLLRCKoJYWoreq8';
const DESTINATION_FOLDER_ID = '1FKxwfcP4L55-B4OsRhX-w-6GWgJ3WOcg';

const CLIENTS_CONFIG = {
  '1': {
    name: "BigZon",
    cif: "ESB85181105",
    color: {
      header: "#116167",
      personalData: "#47979e",
      text: "#fff"
    },
    workingUnits: days => days,
    hoursPerDay: monthName => monthName === 'Agosto' ? 7 : 8,
    hourFee: 43.75,
    fee: (hourFee, hoursPerDay) => hourFee * hoursPerDay,
    onCallFee: 300,
    address: {
      firstLine: "Paseo de la Castellana, 200",
      secondLine: "28046 Madrid"
    }
  },
  '2': {
    name: "FeuVert",
    cif: "A79783254",
    color: {
      header: "#315e41",
      personalData: "#497e38",
      text: "#fff"
    },
    workingUnits: days => days * 8,
    hourFee: 43,
    fee: (hourFee, hoursPerDay) => hourFee,
    address: {
      firstLine: "c/ Condesa de Venadito, 1",
      secondLine: "28027 Madrid"
    }
  },
};

function buildInvoice(clientName, date, workingDays, onCallWeeks) {
  let sheetData = undefined;
  try {
    const clientData = findClientData(clientName);
    if (!clientData) return;

    const dateData = findDateData(date);
    if (!dateData) return;

    sheetData = buildSheet(clientData.name)

    const workingUnits = clientData.workingUnits(workingDays);    
    const invoiceNumber = getNextInvoiceNumber(dateData.year);

    updateInvoiceSheet(sheetData.sheet, invoiceNumber, dateData, clientData, workingUnits, onCallWeeks);

    return generateNewInvoice(sheetData.sheet, invoiceNumber, dateData, clientData);
  } catch (e) {
    Logger.log(e);
  } finally {
    if (sheetData?.tempFile) {
      deleteFile(sheetData.tempFile.getId());
      Logger.log(`Temporal spreadsheet ${sheetData.tempFile.getName()} deleted`);
    }
  }
}

function findClientData(clientName) {
  const clientConfig = Object.values(CLIENTS_CONFIG).find(client => client.name === clientName);

  if (!clientConfig) {
    Logger.error(`Invalid selection. Please enter a number from the list.`);
    return;
  }

  Logger.log('Selected client data: \n%s', JSON.stringify(clientConfig, null, 2));

  return clientConfig;
}

function findDateData(date) {
  const currentYear = date.getFullYear().toString();
  
  const monthInput = date.getMonth() + 1;
  const monthNumber = parseInt(monthInput, 10);

  // Valida que la entrada sea un número válido y esté en el rango correcto.
  if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    ui.alert('Entrada inválida. Por favor, introduce un número de mes entre 1 y 12.');
    return null;
  }

  const month = String(monthNumber).padStart(2, '0');
  const year = currentYear;
  
  const dateObject = new Date(year, month - 1, 1);
  const monthNameSpanish = dateObject.toLocaleString('es-ES', { month: 'long' });
  const formattedMonthName = monthNameSpanish.charAt(0).toUpperCase() + monthNameSpanish.slice(1);
  
  const nextMonthObject = new Date(year, monthNumber, 1);

  const nextMonthDate = Utilities.formatDate(nextMonthObject, Session.getScriptTimeZone(), "dd/MM/yyyy");
  
  Logger.log(`Date: ${month}/${year}`);

  return {
    month: month,
    year: year,
    monthName: formattedMonthName,
    nextMonthDate: nextMonthDate
  };
}

function buildSheet(clientName) {
  const templateFile = DriveApp.getFileById(INVOICE_TEMPLATE_SPREADSHEET_ID);
  const tempFile = templateFile.makeCopy(`TEMP_INVOICE_${clientName}_${Date.now()}`);
  
  return { tempFile: tempFile, sheet: SpreadsheetApp.openById(tempFile.getId()) };
}

function getNextInvoiceNumber(year) {
  const folder = findFolder(year);
  if (!folder) {
    Logger.log(`No se encontró la carpeta para el año ${date.getFullYear()}. Se asumirá que es la primera factura.`);
    return 1;
  }
  
  const files = folder.getFiles();
  let maxNumber = 0;

  // Expresión regular para el nuevo formato: "2025_12_...".
  // Busca el año al principio, un guion bajo, y captura los dígitos siguientes.
  const regex = new RegExp(`^${year}_(\\d+)`);

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const match = fileName.match(regex);

    if (match && match[1]) {
      const currentNumber = parseInt(match[1], 10);
      if (currentNumber > maxNumber) {
        maxNumber = currentNumber;
      }
    }
  }
  
  const invoiceNumber = maxNumber + 1;
  Logger.info(`Invoice number: ${invoiceNumber}`);
  return maxNumber + 1;
}

function findFolder(year) {
  const parentFolder = DriveApp.getFolderById(DESTINATION_FOLDER_ID);
  const currentYearFolder = parentFolder.getFoldersByName(year);
  return currentYearFolder.hasNext() ? currentYearFolder.next() : parentFolder.createFolder(year);
}

function updateInvoiceSheet(sheet, invoiceNumber, dateData, clientData, workingUnits, onCallWeeks) {
  sheet.getRange("G3").setValue(invoiceNumber);
  sheet.getRange("H3").setValue(dateData.monthName);
  sheet.getRange("I3").setValue(dateData.nextMonthDate);
  
  sheet.getRange("B23").setValue(clientData.address.firstLine);
  sheet.getRange("B24").setValue(clientData.address.secondLine);

  sheet.getRange('B18').setValue(clientData.name);
  sheet.getRange('B20').createTextFinder('{{clientCif}}').replaceAllWith(clientData.cif);

  const hoursPerDay = clientData.hoursPerDay(dateData.monthName);
  Logger.log(hoursPerDay);
  const fee = clientData.fee(clientData.hourFee, hoursPerDay);
  Logger.log(`${dateData.monthName} month fee (${hoursPerDay} h/day): ${fee}`)
  sheet.getRange('C29').createTextFinder('{{monthName}}').replaceAllWith(dateData.monthName);
  sheet.getRange('G29').setValue(workingUnits);
  sheet.getRange('H29').setValue(fee);
  
  const onCallFee = clientData.onCallFee || 0; 
  let onCallWeeksText = 'Sin guardias';
  let numOnCallWeeks = 0;

  // Si hay guardias en el mes, formateamos el texto y contamos las semanas
  if (onCallWeeks && onCallWeeks.length > 0) {
    onCallWeeksText = onCallWeeks.map(week => `${week.from} - ${week.to}`).join(', ');
    numOnCallWeeks = onCallWeeks.length;
  }
  sheet.getRange('C30').createTextFinder('{{onCallWeeksText}}').replaceAllWith(onCallWeeksText);
  sheet.getRange('G30').createTextFinder('{{onCallWeeks}}').replaceAllWith(numOnCallWeeks);
  sheet.getRange('H30').createTextFinder('{{onCallfee}}').replaceAllWith(onCallFee);
  
  sheet.getRange('A1:K4').setBackground(clientData.color.header);
  sheet.getRange('A5:K15').setBackground(clientData.color.personalData);
  sheet.getRange('A5:K15').setFontColor(clientData.color.text);
  
  // insertIcons(sheet, clientData.icons)

  SpreadsheetApp.flush();
}

// function insertIcons(sheet, iconsMap) {
//   const icons = Object.values(iconsMap);

//   icons.forEach(iconData => {
//     insertIcon(sheet, iconData.id, iconData.width, iconData.dimensions);
//   });
// }

// function insertIcon(sheet, iconId, width, dimensions) {
//   try {
//     const { column, row, offsetX, offsetY } = dimensions;

//     const iconBlob = DriveApp.getFileById(iconId).getBlob();
    
//     const image = sheet.insertImage(iconBlob, column, row, offsetX, offsetY);
    
//     SpreadsheetApp.flush();
    
//     const originalWidth = image.getWidth();
//     const originalHeight = image.getHeight();
    
//     if (originalWidth > 0) {
//       const aspectRatio = originalWidth / originalHeight;
//       const newHeight = width / aspectRatio;
      
//       image.setWidth(width);
//       image.setHeight(newHeight);
//     }
    
//     Logger.log(`Icono con ID ${iconId} colocado y redimensionado.`);
//     return image;
//   } catch (e) {
//     Logger.log(`Error al colocar el icono con ID ${iconId}: ${e.toString()}`);
//   }
// }

function generateNewInvoice(sheet, invoiceNumber, dateData, clientData) {
  const destinationFolder = findFolder(dateData.year);
  const fileName = `${dateData.year}_${invoiceNumber}_${clientData.name}_marco-martinez-avila_${dateData.monthName.toLowerCase()}.pdf`
  const url = `https://docs.google.com/spreadsheets/d/${sheet.getId()}/export?`;

  const exportOptions = {
    exportFormat: 'pdf',
    format: 'pdf',
    size: 'A4',
    portrait: 'true',
    fitw: 'true',
    top_margin: '1.85',
    bottom_margin: '0.3',
    left_margin: '0.3',
    right_margin: '0.3',
    sheetnames: 'false',
    printtitle: 'false',
    gridlines: 'false',
    fzr: 'false',
    gid: sheet.getSheetId()
  };

  let params = Object.entries(exportOptions).map(([key, value]) => `${key}=${value}`).join('&');
  const response = UrlFetchApp.fetch(`${url}${params}`, {
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true
  });

  const pdfBlob = response.getBlob();
  pdfBlob.setName(fileName);
  destinationFolder.createFile(pdfBlob);
  return pdfBlob;
}

/**
 * Mueve un archivo a la papelera usando su ID.
 * @param {string} fileId El ID del archivo a eliminar.
 */
function deleteFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
  } catch (e) {
    Logger.log(`No se pudo eliminar el archivo con ID ${fileId}. Puede que ya estuviera borrado. Error: ${e.toString()}`);
  }
}