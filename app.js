const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const rowCount = document.getElementById("rowCount");
const columnCount = document.getElementById("columnCount");
const previewTable = document.getElementById("previewTable");
const previewWrapper = document.getElementById("previewWrapper");
const mappingTable = document.getElementById("mappingTable");
const mappingWrapper = document.getElementById("mappingWrapper");
const dedupeKey = document.getElementById("dedupeKey");
const autoMapButton = document.getElementById("autoMap");
const approvalCheck = document.getElementById("approvalCheck");
const ingestButton = document.getElementById("ingestButton");
const progressBar = document.getElementById("progressBar");
const ingestStatus = document.getElementById("ingestStatus");
const databaseTable = document.getElementById("databaseTable");
const newCount = document.getElementById("newCount");
const duplicateCount = document.getElementById("duplicateCount");
const lastImportSummary = document.getElementById("lastImportSummary");
const dbCount = document.getElementById("dbCount");
const lastImport = document.getElementById("lastImport");
const startNewButton = document.getElementById("startNew");
const viewDocsButton = document.getElementById("viewDocs");

const schema = [
  { key: "id", label: "Customer ID", type: "text" },
  { key: "full_name", label: "Full name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "company", label: "Company", type: "text" },
  { key: "status", label: "Status", type: "text" },
  { key: "signup_date", label: "Signup date", type: "date" },
  { key: "source_file", label: "Source file", type: "text" },
];
const typeOptions = ["text", "number", "date", "boolean"];

let parsedData = [];
let columns = [];
let mapping = [];
let database = JSON.parse(localStorage.getItem("dataharbor-db")) || [];

const updateDatabaseMetrics = () => {
  dbCount.textContent = database.length.toString();
  if (database.length) {
    const last = database[database.length - 1];
    lastImport.textContent = `Last import: ${last.source_file || "Manual"}`;
  }
};

const resetProgress = () => {
  progressBar.style.width = "0%";
  ingestStatus.textContent = "Awaiting approval.";
};

const normalizeHeader = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseCsv = (text) => {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].split(",").map((header) => header.replace(/^"|"$/g, "").trim());
  const records = rows.slice(1).map((row) => {
    const values = row.split(",");
    return headers.reduce((acc, header, index) => {
      acc[header] = (values[index] || "").replace(/^"|"$/g, "").trim();
      return acc;
    }, {});
  });
  return { headers, records };
};

const parseWorkbook = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const headers = json.length ? Object.keys(json[0]) : [];
  return { headers, records: json };
};

const renderPreview = () => {
  previewWrapper.style.display = columns.length ? "block" : "none";
  previewTable.innerHTML = "";
  if (!columns.length) return;

  const headerRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  });
  previewTable.appendChild(headerRow);

  parsedData.slice(0, 5).forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      td.textContent = row[col] ?? "";
      tr.appendChild(td);
    });
    previewTable.appendChild(tr);
  });
};

const renderMappingTable = () => {
  mappingWrapper.style.display = columns.length ? "block" : "none";
  mappingTable.innerHTML = "";
  if (!columns.length) return;

  const header = document.createElement("tr");
  ["Source column", "Sample", "Database field", "Data type"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    header.appendChild(th);
  });
  mappingTable.appendChild(header);

  mapping = columns.map((column) => {
    const sample = parsedData[0]?.[column] ?? "";
    return {
      column,
      sample,
      field: "ignore",
      type: "text",
    };
  });

  mapping.forEach((mapItem) => {
    const tr = document.createElement("tr");
    const colCell = document.createElement("td");
    colCell.textContent = mapItem.column;

    const sampleCell = document.createElement("td");
    sampleCell.textContent = mapItem.sample;

    const fieldCell = document.createElement("td");
    const fieldSelect = document.createElement("select");
    const ignoreOption = document.createElement("option");
    ignoreOption.value = "ignore";
    ignoreOption.textContent = "Ignore";
    fieldSelect.appendChild(ignoreOption);
    schema.forEach((field) => {
      const option = document.createElement("option");
      option.value = field.key;
      option.textContent = `${field.label} (${field.key})`;
      fieldSelect.appendChild(option);
    });
    fieldSelect.addEventListener("change", (event) => {
      mapItem.field = event.target.value;
    });
    fieldCell.appendChild(fieldSelect);

    const typeCell = document.createElement("td");
    const typeSelect = document.createElement("select");
    typeOptions.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      typeSelect.appendChild(option);
    });
    typeSelect.addEventListener("change", (event) => {
      mapItem.type = event.target.value;
    });
    typeCell.appendChild(typeSelect);

    tr.appendChild(colCell);
    tr.appendChild(sampleCell);
    tr.appendChild(fieldCell);
    tr.appendChild(typeCell);
    mappingTable.appendChild(tr);
  });

  dedupeKey.innerHTML = "";
  schema.forEach((field) => {
    const option = document.createElement("option");
    option.value = field.key;
    option.textContent = `${field.label} (${field.key})`;
    dedupeKey.appendChild(option);
  });
  dedupeKey.value = "email";
};

const autoMapColumns = () => {
  const normalized = schema.reduce((acc, field) => {
    acc[field.key] = field.key;
    acc[field.label.toLowerCase().replace(/\s+/g, "_")] = field.key;
    return acc;
  }, {});

  Array.from(mappingTable.querySelectorAll("tr")).slice(1).forEach((row, index) => {
    const mapItem = mapping[index];
    const norm = normalizeHeader(mapItem.column);
    const match = normalized[norm];
    if (match) {
      const select = row.querySelector("select");
      select.value = match;
      mapItem.field = match;
      const schemaMatch = schema.find((item) => item.key === match);
      if (schemaMatch) {
        const typeSelect = row.querySelectorAll("select")[1];
        typeSelect.value = schemaMatch.type;
        mapItem.type = schemaMatch.type;
      }
    }
  });
};

const castValue = (value, type) => {
  if (type === "number") {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }
  if (type === "date") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (type === "boolean") {
    return ["true", "yes", "1"].includes(String(value).toLowerCase());
  }
  return value ?? "";
};

const renderDatabaseTable = () => {
  databaseTable.innerHTML = "";
  const headerRow = document.createElement("tr");
  schema.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = field.label;
    headerRow.appendChild(th);
  });
  databaseTable.appendChild(headerRow);

  const recent = database.slice(-6).reverse();
  recent.forEach((record) => {
    const tr = document.createElement("tr");
    schema.forEach((field) => {
      const td = document.createElement("td");
      td.textContent = record[field.key] ?? "";
      tr.appendChild(td);
    });
    databaseTable.appendChild(tr);
  });
};

const ingestData = () => {
  if (!parsedData.length) {
    ingestStatus.textContent = "Upload a file to ingest.";
    return;
  }
  const dedupeField = dedupeKey.value;
  const dedupeSet = new Set(database.map((record) => record[dedupeField]));
  const mappedFields = mapping.filter((item) => item.field !== "ignore");

  let added = 0;
  let skipped = 0;
  const total = parsedData.length;
  let current = 0;

  ingestStatus.textContent = "Ingesting records...";
  progressBar.style.width = "0%";

  const interval = setInterval(() => {
    const row = parsedData[current];
    if (!row) {
      clearInterval(interval);
      localStorage.setItem("dataharbor-db", JSON.stringify(database));
      newCount.textContent = added.toString();
      duplicateCount.textContent = skipped.toString();
      const summary = `${added} new, ${skipped} duplicates`;
      lastImportSummary.textContent = summary;
      ingestStatus.textContent = `Ingestion complete: ${summary}.`;
      updateDatabaseMetrics();
      renderDatabaseTable();
      return;
    }

    const record = {};
    mappedFields.forEach((item) => {
      record[item.field] = castValue(row[item.column], item.type);
    });
    record.source_file = fileName.textContent;

    const dedupeValue = record[dedupeField];
    if (dedupeValue && dedupeSet.has(dedupeValue)) {
      skipped += 1;
    } else {
      database.push(record);
      if (dedupeValue) {
        dedupeSet.add(dedupeValue);
      }
      added += 1;
    }

    current += 1;
    const progress = Math.min((current / total) * 100, 100);
    progressBar.style.width = `${progress}%`;
  }, 120);
};

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  fileName.textContent = file.name;
  resetProgress();

  try {
    let result;
    if (file.name.endsWith(".csv")) {
      const text = await file.text();
      result = parseCsv(text);
    } else {
      result = await parseWorkbook(file);
    }
    columns = result.headers;
    parsedData = result.records;
    rowCount.textContent = parsedData.length.toString();
    columnCount.textContent = columns.length.toString();
    renderPreview();
    renderMappingTable();
  } catch (error) {
    ingestStatus.textContent = "Unable to read that file. Please try again.";
  }
});

approvalCheck.addEventListener("change", (event) => {
  ingestButton.disabled = !event.target.checked;
});

ingestButton.addEventListener("click", () => {
  ingestData();
});

autoMapButton.addEventListener("click", () => {
  autoMapColumns();
});

startNewButton.addEventListener("click", () => {
  fileInput.value = "";
  fileName.textContent = "No file selected";
  rowCount.textContent = "0";
  columnCount.textContent = "0";
  parsedData = [];
  columns = [];
  mapping = [];
  previewTable.innerHTML = "";
  mappingTable.innerHTML = "";
  previewWrapper.style.display = "none";
  mappingWrapper.style.display = "none";
  approvalCheck.checked = false;
  ingestButton.disabled = true;
  resetProgress();
});

viewDocsButton.addEventListener("click", () => {
  document.getElementById("documentation").scrollIntoView({ behavior: "smooth" });
});

updateDatabaseMetrics();
renderDatabaseTable();
