import assert from 'node:assert';

async function runTests() {
  const host = process.env.TEST_HOST || 'http://localhost:3000';

  console.log(`[Voice Action Router] Ejecutando pruebas sobre ${host}...`);

  console.log('--- TEST 1: Caso A - Rampage con regla y prefijo personalizado ---');
  {
    const res = await fetch(`${host}/api/ai/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spokenText: "Hazme un Rampage basado en mi identidad con el matiz de que todas las oraciones comienzan con 'Yo soy Dios y por lo tanto...'",
        currentProfile: 'facu',
        activeManifestations: [],
        sandbox: true,
      }),
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.intent, 'START_RAMPAGE');
    assert.strictEqual(json.data.rampageData.count, 11);
    assert.strictEqual(json.data.rampageData.ambientSound, 'white_noise');
    assert(json.data.rampageData.affirmations.length === 11);
    assert(json.data.rampageData.affirmations.every(a => a.startsWith('Yo soy Dios y por lo tanto ')));
    console.log('✓ Caso A pasó exitosamente.');
  }

  console.log('--- TEST 2: Caso B - Nueva Manifestación Directa ---');
  {
    const res = await fetch(`${host}/api/ai/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spokenText: 'Registrar una nueva manifestación donde quiero comer sushi durante toda la semana',
        currentProfile: 'facu',
        activeManifestations: [],
        sandbox: true,
      }),
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.intent, 'CREATE_MANIFESTATION');
    assert.strictEqual(json.data.manifestationData.title, 'Comer sushi durante toda la semana');
    assert(json.data.manifestationData.description.length > 0);
    console.log('✓ Caso B pasó exitosamente.');
  }

  console.log('--- TEST 3: Caso C - Avance con Creación Retroactiva ---');
  {
    const res = await fetch(`${host}/api/ai/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spokenText: 'La semana pasada estuve manifestando hacer yoga tres días a la semana y justo hoy se me presentó una oportunidad para iniciar yoga tres días a la semana',
        currentProfile: 'facu',
        activeManifestations: [{ id: 'manif_1', title: 'Comprar auto nuevo' }],
        sandbox: true,
      }),
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.intent, 'LOG_PROGRESS');
    assert.ok(json.data.retroactiveManifestation);
    assert.strictEqual(json.data.retroactiveManifestation.title, 'Hago yoga 3 veces por semana');
    assert.ok(json.data.progressData.note);
    console.log('✓ Caso C (retroactivo) pasó exitosamente.');
  }

  console.log('--- TEST 4: Caso C - Avance con Vinculación Semántica Existente ---');
  {
    const res = await fetch(`${host}/api/ai/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spokenText: 'Hoy se me presentó una oportunidad para avanzar con yoga',
        currentProfile: 'facu',
        activeManifestations: [{ id: 'manif_yoga', title: 'Hacer yoga regularmente' }],
        sandbox: true,
      }),
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.intent, 'LOG_PROGRESS');
    assert.strictEqual(json.data.progressData.manifestationId, 'manif_yoga');
    console.log('✓ Caso C (vinculado) pasó exitosamente.');
  }

  console.log('--- TEST 5: Caso C2 - Éxito Cumplido ---');
  {
    const res = await fetch(`${host}/api/ai/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spokenText: '¡Se cumplió mi manifestación de yoga por completo!',
        currentProfile: 'facu',
        activeManifestations: [{ id: 'manif_yoga', title: 'Hacer yoga regularmente' }],
        sandbox: true,
      }),
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.intent, 'LOG_SUCCESS');
    assert.strictEqual(json.data.successData.manifestationId, 'manif_yoga');
    console.log('✓ Caso C2 (éxito) pasó exitosamente.');
  }

  console.log('--- TEST 6: Caso D - Voz no comprensible / Estática (Estilo Siri) ---');
  {
    const res = await fetch(`${host}/api/ai/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spokenText: 'ininteligible',
        currentProfile: 'facu',
        activeManifestations: [],
        sandbox: true,
      }),
    });
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.intent, 'UNKNOWN');
    assert.strictEqual(json.data.assistantFeedback, 'No alcancé a entenderte bien. ¿Podrías repetirlo?');
    console.log('✓ Caso D (Siri Unclear) pasó exitosamente.');
  }

  console.log('\nTODOS LOS TESTS DE VOICE ACTION ROUTER PASARON EXITOSAMENTE.');
}

runTests().catch(err => {
  console.error('Test falló:', err);
  process.exit(1);
});
