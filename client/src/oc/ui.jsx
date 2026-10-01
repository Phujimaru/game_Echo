// ชิ้นส่วน UI กลางของธีม ORDEAL CALL (คลาสอยู่ใน oc/theme.css)
import { useContext } from "react";
import { PATCH_NAME, PATCH_VERSION } from "../data/patch";
import { SharedGlobeContext } from "../globe/SharedGlobe";

/** พื้นหน้าจอขาวอมฟ้า + มุมจอ 4 มุม + ชื่อแพตช์มุมซ้ายบน */
//  อยู่ใต้ลูกโลกร่วม (SharedGlobeStage) = พื้นโปร่งใส ให้เห็นโลก/พื้นที่ฉากร่วมวาดไว้ข้างล่าง
export function OcScreen({ children, className = "", mark = true, ...rest }) {
  const shared = !!useContext(SharedGlobeContext);
  return (
    <div className={`oc-screen${shared ? " is-shared" : ""} ${className}`} {...rest}>
      {children}
      <div className="oc-chrome" aria-hidden="true">
        <i className="oc-tick tl" /><i className="oc-tick tr" /><i className="oc-tick bl" /><i className="oc-tick br" />
        {mark && <span className="oc-mark">ECHO <b>{PATCH_VERSION}</b> · {PATCH_NAME}</span>}
      </div>
    </div>
  );
}

export function OcPanel({ as: Tag = "div", className = "", children, ...rest }) {
  return <Tag className={`oc-panel ${className}`} {...rest}>{children}</Tag>;
}

export function OcButton({ variant = "", className = "", type = "button", children, ...rest }) {
  return <button type={type} className={`oc-btn ${variant} ${className}`} {...rest}>{children}</button>;
}

/** โลโก้ ECHO เดิม + ชื่อแพตช์ใต้โลโก้ */
export function EchoLogo({ small = false, patch = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: small ? 6 : 12, alignItems: small ? "flex-start" : "center" }}>
      <div className="oc-echo-logo" role="img" aria-label="ECHO" style={small ? { width: "min(300px,70vw)" } : undefined} />
      {patch && <p className="oc-logo-text" style={{ margin: 0, fontSize: small ? 14 : 22 }}>ORDEAL <span>CALL</span></p>}
    </div>
  );
}
