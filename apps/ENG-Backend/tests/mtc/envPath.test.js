'use strict';

// PATHS is frozen at require time, so each case has to set the env var and then get a
// fresh copy of the module.
function pathsWith(value) {
  if (value === undefined) delete process.env.TI_CSV_OUTPUT_DIR;
  else process.env.TI_CSV_OUTPUT_DIR = value;
  jest.resetModules();
  return require('../../api/engineer/mtc/mtcConstants').PATHS;
}

const TARGET = String.raw`D:\ToolingInspectionCSV`;
const UNC = String.raw`\\sanlb01\MPA-DIV\out`;

describe('env paths tolerate both .env conventions', () => {
  const original = process.env.TI_CSV_OUTPUT_DIR;
  afterAll(() => {
    if (original === undefined) delete process.env.TI_CSV_OUTPUT_DIR;
    else process.env.TI_CSV_OUTPUT_DIR = original;
    jest.resetModules();
  });

  it('reads a plain KEY=value', () => {
    expect(pathsWith(TARGET).TI_CSV_OUTPUT_DIR).toBe(TARGET);
  });

  it("reads the JS-assignment style KEY = 'value'; the Gmail keys use", () => {
    // This is the form that produced
    //   ENOENT: mkdir 'D:\...\ENG-Backend\'D:\ToolingInspectionCSV';'
    // on plbmp130 — the quotes and semicolon became part of the path and Node then
    // resolved the whole thing relative to the backend directory.
    expect(pathsWith(`'${TARGET}';`).TI_CSV_OUTPUT_DIR).toBe(TARGET);
  });

  it('accepts single quotes, double quotes, and a stray trailing semicolon', () => {
    expect(pathsWith(`'${TARGET}'`).TI_CSV_OUTPUT_DIR).toBe(TARGET);
    expect(pathsWith(`"${TARGET}"`).TI_CSV_OUTPUT_DIR).toBe(TARGET);
    expect(pathsWith(`${TARGET};`).TI_CSV_OUTPUT_DIR).toBe(TARGET);
  });

  it('trims surrounding whitespace', () => {
    expect(pathsWith(`   ${TARGET}   `).TI_CSV_OUTPUT_DIR).toBe(TARGET);
  });

  it('leaves a UNC path intact — leading backslashes are not quoting', () => {
    expect(pathsWith(UNC).TI_CSV_OUTPUT_DIR).toBe(UNC);
    expect(pathsWith(`'${UNC}';`).TI_CSV_OUTPUT_DIR).toBe(UNC);
  });

  it("does not strip a lone quote that isn't a matching pair", () => {
    // Half a quote is a typo, and silently rewriting it would hide the mistake rather
    // than let the ENOENT name it.
    expect(pathsWith(`'${TARGET}`).TI_CSV_OUTPUT_DIR).toBe(`'${TARGET}`);
  });

  it('falls back to the Google Drive default when unset', () => {
    expect(pathsWith(undefined).TI_CSV_OUTPUT_DIR)
      .toBe(String.raw`G:\Shared drives\ROD-Engineer\ToolingInspection`);
  });
});
