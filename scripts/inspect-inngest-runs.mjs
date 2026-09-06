// Read-only diagnostics. Does not print event payloads, prompts, or step output.
const typeRef = "kind name ofType { kind name ofType { kind name ofType { kind name } } }";
async function query(query, variables) {
  const response = await fetch("http://localhost:8288/v0/gql", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  return result.data;
}
const schema = await query(`{ __schema { types { name kind fields { name type { ${typeRef} } args { name type { ${typeRef} } } } inputFields { name type { ${typeRef} } defaultValue } enumValues { name } } } }`);
const types = schema.__schema.types;
const span = types.find((type) => type.name === "RunTraceSpan");
const safeFields = new Set(["name", "status", "startedAt", "endedAt", "durationMS", "attempts"]);
const spanFields = span.fields.filter((field) => safeFields.has(field.name) && !field.args.length).map((field) => field.name).join(" ");
const children = span.fields.find((field) => field.name === "children");
const trace = children ? `${spanFields} children { ${spanFields} children { ${spanFields} } }` : spanFields;
const runs = await query(`query($from: Time!) { runs(first: 6, orderBy: [{field: QUEUED_AT, direction: DESC}], filter: {from: $from}) { edges { node { id status queuedAt startedAt endedAt function { name } trace { ${trace} } } } } }`, {
  from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
});
console.log(JSON.stringify(runs));
