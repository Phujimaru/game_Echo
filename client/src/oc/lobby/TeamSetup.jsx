// จัดทีม (gameState TEAM_SETUP) — คอลัมน์ทีมละใบ · เข้าทีม (chooseTeam) · ยืนยัน (confirmTeam) · เปลี่ยนโหมด (teamBackToMode)
import { socket } from "../../socket";
import { clickSound } from "../../audio";
import { OcButton } from "../ui";

const TEAM_COLORS = { A: "#b95fc4", B: "#e8bf5a", C: "#5fc4a0" };
const teamColor = (id) => TEAM_COLORS[id] || "var(--oc-echo)";

export default function TeamSetup({ state, onBack }) {
  const me = state.players.find((p) => p.id === state.youId);
  const teams = state.teamOptions || [];
  const teamSize = state.teamSize || 2;
  const readyCount = state.players.filter((p) => p.teamConfirmed).length;
  const modeName = state.gameMode === "trio" ? "สหายทั้ง 3 เอ๋ย" : "คู่หู";

  return (
    <div className="oc-layer ocl-teams">
      <header className="ocl-title oc-enter">
        <h1 className="oc-h1">จัดทีม</h1>
        <span className="oc-label">{modeName} · ทีมละ {teamSize} คน</span>
      </header>

      <div className="ocl-team-actions oc-enter d1">
        <OcButton onClick={() => { clickSound(); socket.emit("teamBackToMode"); }}>เปลี่ยนโหมด</OcButton>
        <OcButton
          variant={me?.teamConfirmed ? "" : "primary"}
          disabled={!me?.teamId}
          onClick={() => { clickSound(); socket.emit("confirmTeam", { confirmed: !me?.teamConfirmed }); }}
        >
          {me?.teamConfirmed ? "ยกเลิก" : "ยืนยัน"}
        </OcButton>
      </div>

      <div className="ocl-team-grid">
        {teams.map((team, ti) => {
          const members = state.players.filter((p) => p.teamId === team.id).sort((a, b) => a.position - b.position);
          const canJoin = !!me && !me.teamConfirmed && (members.length < teamSize || me.teamId === team.id);
          const mine = me?.teamId === team.id;
          return (
            <section
              key={team.id}
              className={`ocl-team oc-panel oc-enter${mine ? " mine" : ""}`}
              style={{ "--t": teamColor(team.id), animationDelay: `${0.08 * (ti + 1)}s` }}
            >
              <div className="ocl-team-head">
                <span className="ocl-team-id">{team.id}</span>
                <span className="ocl-team-count">{members.length} / {teamSize}</span>
              </div>
              <ul className="ocl-team-slots">
                {Array.from({ length: teamSize }).map((_, i) => {
                  const p = members[i];
                  return p ? (
                    <li key={p.id} className="ocl-slot" data-ready={p.teamConfirmed ? "true" : "false"} style={{ "--c": p.color }}>
                      <span className="ocl-slot-seat oc-latin">P{p.position}</span>
                      <b>{p.name}{p.id === state.youId ? " (คุณ)" : ""}</b>
                      <span className="ocl-slot-state">{p.teamConfirmed ? "พร้อม" : "รอ"}</span>
                    </li>
                  ) : (
                    <li key={`e${i}`} className="ocl-slot ocl-slot-empty">ว่าง</li>
                  );
                })}
              </ul>
              <OcButton
                variant={mine ? "primary" : ""}
                className="ocl-team-join"
                disabled={!canJoin}
                onClick={() => { clickSound(); socket.emit("chooseTeam", { teamId: team.id }); }}
              >
                {mine ? "อยู่ทีมนี้" : "เข้าทีมนี้"}
              </OcButton>
            </section>
          );
        })}
      </div>

      <div className="ocl-team-foot oc-enter d2">
        <span className="oc-label">ยืนยันแล้ว</span>
        <b>{readyCount} / {state.players.length}</b>
      </div>

      <OcButton variant="ghost" className="ocl-back" onClick={onBack}>← ย้อนกลับ</OcButton>
    </div>
  );
}
