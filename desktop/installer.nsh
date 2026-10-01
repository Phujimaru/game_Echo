; ECHO — ส่วนเสริมของตัวติดตั้ง/ถอนการติดตั้ง (electron-builder nsis.include)
;  ถอนการติดตั้ง = ลบเฉพาะของ ECHO เอง:
;   - โฟลเดอร์โปรแกรม %LOCALAPPDATA%\Programs\echo-desktop (ชื่อตาม "name" ใน package.json · electron-builder ลบเอง — ด่านด้านล่างกันพลาดก่อนลบ)
;   - ไฟล์เกมที่โหลดมา %APPDATA%\ECHO (+ %APPDATA%\echo-desktop ถ้ามี) (deleteAppDataOnUninstall ใน package.json — ข้ามเมื่อเป็นการอัปเดต)
;   - ไฟล์อัปเดตที่โหลดมารอ %LOCALAPPDATA%\echo-desktop-updater (ด้านล่าง — ข้ามเมื่อเป็นการอัปเดต)
;  macro นี้ทำงานก่อน electron-builder ลบไฟล์ (ดู templates/nsis/uninstaller.nsh) — Abort ตรงนี้ = ไม่มีอะไรถูกลบเลย

!macro customUnInstall
  ; ด่านกันพลาด: electron-builder จะสั่ง RMDir /r $INSTDIR ต่อจากนี้
  ;  ยอมให้ลบเฉพาะเมื่อ $INSTDIR ลงท้ายด้วย \echo-desktop (+ มี ECHO.exe อยู่จริง เมื่อเป็นการถอนการติดตั้ง) ไม่งั้นยกเลิกทั้งหมด
  ;  ตอนอัปเดต/ติดตั้งทับไม่บังคับ ECHO.exe — ให้ติดตั้งทับซ่อมเครื่องที่ไฟล์โปรแกรมหายได้
  ;  (ถ้าเปลี่ยน "name" ใน package.json ต้องแก้ชื่อ + ความยาว -13 ตรงนี้ด้วย)
  Push $R9
  StrCpy $R9 $INSTDIR "" -13
  ${If} $R9 != "\echo-desktop"
    StrCpy $R9 "bad"
  ${ElseIfNot} ${isUpdated}
  ${AndIfNot} ${FileExists} "$INSTDIR\ECHO.exe"
    StrCpy $R9 "bad"
  ${EndIf}
  ${If} $R9 == "bad"
    Pop $R9
    MessageBox MB_OK|MB_ICONSTOP "ยกเลิกการถอนการติดตั้ง: โฟลเดอร์ $INSTDIR ไม่ใช่โฟลเดอร์ของ ECHO" /SD IDOK
    Abort
  ${EndIf}
  Pop $R9

  ${IfNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\echo-desktop-updater"
  ${EndIf}
!macroend
