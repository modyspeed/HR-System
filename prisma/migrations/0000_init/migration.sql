-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarPath" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionKey"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "natureAllowancePct" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "insuranceNo" TEXT,
    "nationalId" TEXT,
    "grade" TEXT,
    "gradeDate" DATETIME,
    "birthDate" DATETIME,
    "permanentDate" DATETIME,
    "hireDate" DATETIME,
    "qualification" TEXT,
    "qualificationYear" INTEGER,
    "fileOriginalName" TEXT,
    "fileStoredName" TEXT,
    "fileSize" INTEGER,
    "fileLinkedAt" DATETIME,
    "contractType" TEXT,
    "departmentId" TEXT,
    "contractTypeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rehiredFromId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_contractTypeId_fkey" FOREIGN KEY ("contractTypeId") REFERENCES "ContractType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_rehiredFromId_fkey" FOREIGN KEY ("rehiredFromId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmployeeStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContractType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BasicSalaryGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "fileOriginalName" TEXT,
    "fileStoredName" TEXT,
    "fileSize" INTEGER,
    "fileLinkedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BasicSalaryGrade_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileOriginalName" TEXT,
    "fileStoredName" TEXT,
    "fileSize" INTEGER,
    "fileLinkedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PayrollBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PayrollEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "basicSalary" REAL,
    "totalEarned" REAL,
    "totalDeductions" REAL,
    "netSalary" REAL,
    "sourceText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Role_key_idx" ON "Role"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RolePermission_permissionKey_idx" ON "RolePermission"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeStatusHistory_employeeId_idx" ON "EmployeeStatusHistory"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeStatusHistory_changedAt_idx" ON "EmployeeStatusHistory"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContractType_name_key" ON "ContractType"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BasicSalaryGrade_employeeId_date_idx" ON "BasicSalaryGrade"("employeeId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Leave_employeeId_idx" ON "Leave"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Leave_type_idx" ON "Leave"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Leave_status_idx" ON "Leave"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Leave_year_idx" ON "Leave"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollBatch_type_period_idx" ON "PayrollBatch"("type", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollEntry_employeeId_type_period_idx" ON "PayrollEntry"("employeeId", "type", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollEntry_period_idx" ON "PayrollEntry"("period");
