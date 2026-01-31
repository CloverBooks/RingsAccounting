use serde_json::json;
use sqlx::SqlitePool;

use crate::companion_autonomy::agents::AgentContext;
use crate::companion_autonomy::models::AgentOutput;

pub async fn run(ctx: &AgentContext) -> Result<AgentOutput, String> {
    let pending = pending_work_items(&ctx.pool, ctx.tenant_id).await.unwrap_or(0);
    if pending == 0 {
        return Ok(AgentOutput::empty());
    }

    let mut output = AgentOutput::empty();
    output.signals.push(json!({
        "type": "orchestrator_summary",
        "pending_work_items": pending
    }));

    Ok(output)
}

async fn pending_work_items(pool: &SqlitePool, tenant_id: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM companion_autonomy_work_items
         WHERE tenant_id = ? AND status IN ('open', 'ready', 'waiting_approval')"
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
}
