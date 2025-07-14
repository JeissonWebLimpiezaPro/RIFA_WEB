// Lógica básica para el sistema de abonos independiente
import('./firebase-service.js');

// Utilidad para limpiar undefined/null de un objeto (recursivo)
function removeUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (obj[key] !== undefined && obj[key] !== null) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

document.addEventListener('DOMContentLoaded', function() {
  const formIdentificar = document.getElementById('formIdentificar');
  const formAbono = document.getElementById('formAbono');
  const abonoMsg = document.getElementById('abonoMsg');
  const volverInicioBtn = document.getElementById('volverInicioBtn');
  const abonosRealizados = document.getElementById('abonosRealizados');
  let participanteActual = null;

  async function buscarParticipante(identificador) {
    let intentos = 0;
    const normalizar = v => (v || '').toString().trim().toLowerCase();
    const normalizarTel = v => (v || '').toString().replace(/\D/g, '');
    const identificadorNorm = normalizar(identificador);
    const identificadorTel = normalizarTel(identificador);
    // Espera a que FirebaseService esté inicializado
    if (!window.FirebaseService) {
      abonoMsg.style.display = 'block';
      abonoMsg.textContent = 'Error: FirebaseService no está disponible.';
      console.error('FirebaseService no está disponible');
      return null;
    }
    const firebaseService = new window.FirebaseService();
    while (!firebaseService.isInitialized && intentos < 50) {
      await new Promise(res => setTimeout(res, 100));
      intentos++;
    }
    if (!firebaseService.isInitialized) {
      abonoMsg.style.display = 'block';
      abonoMsg.textContent = 'Error: Firebase no se pudo inicializar.';
      console.error('Firebase no se pudo inicializar');
      return null;
    }
    let participantes = [];
    try {
      participantes = await firebaseService.getParticipants();
      console.log('Participantes obtenidos:', participantes);
    } catch (e) {
      abonoMsg.style.display = 'block';
      abonoMsg.textContent = 'Error al conectar con la base de datos.';
      console.error('Error al conectar con la base de datos:', e);
      return null;
    }
    // Imprime los valores normalizados para depuración
    console.log('Valor buscado (normalizado):', identificadorNorm);
    console.log('Valor buscado (tel):', identificadorTel);
    console.log('Emails en BD:', participantes.map(p => normalizar(p.email)));
    console.log('Teléfonos en BD:', participantes.map(p => normalizarTel(p.phone)));
    console.log('Números en BD:', participantes.map(p => normalizar(p.number)));
    // Buscar por email, teléfono o número (normalizado y flexible)
    let participante = participantes.find(p => {
      if (!p) return false;
      // Email
      if (normalizar(p.email) === identificadorNorm) return true;
      // Teléfono (solo dígitos)
      if (normalizarTel(p.phone) === identificadorTel) return true;
      // Número (como string o número)
      if (
        normalizar(p.number) === identificadorNorm ||
        String(p.number) === identificador ||
        Number(p.number) === Number(identificador)
      ) return true;
      return false;
    });
    if (!participante) {
      // Ayuda de depuración: muestra todos los emails/números encontrados
      const emails = participantes.map(p => p.email).filter(Boolean);
      const phones = participantes.map(p => p.phone).filter(Boolean);
      const numbers = participantes.map(p => p.number).filter(Boolean);
      console.warn('No se encontró participante. Emails en BD:', emails);
      console.warn('Teléfonos en BD:', phones);
      console.warn('Números en BD:', numbers);
    }
    return participante;
  }

  function mostrarInfoParticipante(participante) {
    const infoDiv = document.getElementById('infoParticipante');
    if (!participante) {
      infoDiv.style.display = 'none';
      return;
    }
    document.getElementById('pNombre').textContent = participante.name || '';
    document.getElementById('pEmail').textContent = participante.email || '';
    document.getElementById('pTelefono').textContent = participante.phone || '';
    document.getElementById('pNumero').textContent = participante.number !== undefined ? participante.number : '';
    let plan = participante.paymentPlan;
    if (plan) {
      document.getElementById('pPlan').textContent = plan.type ? plan.type : 'Pago Total';
      document.getElementById('pCuotasPagadas').textContent = plan.currentInstallment || 1;
      document.getElementById('pTotalCuotas').textContent = plan.selectedInstallments || plan.installments || 1;
    } else {
      document.getElementById('pPlan').textContent = 'Pago Total';
      document.getElementById('pCuotasPagadas').textContent = '1';
      document.getElementById('pTotalCuotas').textContent = '1';
    }
    infoDiv.style.display = 'block';
  }

  function mostrarAbonos(participante) {
    abonosRealizados.innerHTML = '';
    if (!participante) return;
    let plan = participante.paymentPlan;
    let recibos = [];
    let totalCuotas = 1;
    let cuotasPagadas = 0;
    let totalPagado = 0;
    let totalRifa = 0;
    let pagado = false;
    // Agregar el primer pago si existe
    if (participante.receiptFile) {
      recibos.push(participante.receiptFile);
      totalPagado = participante.receiptFile.amount || 0;
      totalRifa = participante.receiptFile.amount || 0;
    }
    // Agregar abonos si existen
    if (plan && Array.isArray(plan.receipts)) {
      recibos = recibos.concat(plan.receipts);
      totalCuotas = plan.selectedInstallments || plan.installments || 1;
      cuotasPagadas = plan.currentInstallment ? plan.currentInstallment - 1 : plan.receipts.length;
      totalPagado = plan.paidAmount || totalPagado;
      totalRifa = plan.totalAmount || totalRifa;
      // Determinar si está pagado solo si es pago único o si el plan está completamente pagado
      if (plan && Array.isArray(plan.receipts)) {
        pagado = (plan.remainingAmount !== undefined && plan.remainingAmount <= 0.01) || (plan.currentInstallment >= totalCuotas);
      } else if (participante.receiptFile && !plan) {
        pagado = true;
      } else {
        pagado = false;
      }
    } else if (participante.receiptFile) {
      pagado = true;
    }
    if (recibos.length === 0) {
      abonosRealizados.innerHTML = '<div style="color:#64748b;">No hay abonos registrados.</div>';
      return;
    }
    let html = '<h3 style="color:#27ae60; font-size:1.1rem; margin-bottom:10px;">Desprendibles de pago</h3>';
    // Mostrar estado solo si hay pagos
    if (plan && Array.isArray(plan.receipts)) {
      // Plan fraccionado
      if (pagado && totalCuotas > 1) {
        html += '<div style="background:#d1fae5;color:#059669;padding:10px 0;border-radius:8px;text-align:center;font-weight:bold;font-size:1.1rem;margin-bottom:12px;letter-spacing:0.5px;box-shadow:0 2px 8px #05966922;">✅ PAGO COMPLETO</div>';
      } else {
        html += '<div style="background:#fef3c7;color:#d97706;padding:10px 0;border-radius:8px;text-align:center;font-weight:bold;font-size:1.1rem;margin-bottom:12px;letter-spacing:0.5px;box-shadow:0 2px 8px #d9770622;">⏳ PENDIENTE DE PAGO</div>';
      }
    } else if (participante.receiptFile && !plan) {
      // Pago único
      html += '<div style="background:#d1fae5;color:#059669;padding:10px 0;border-radius:8px;text-align:center;font-weight:bold;font-size:1.1rem;margin-bottom:12px;letter-spacing:0.5px;box-shadow:0 2px 8px #05966922;">✅ PAGO COMPLETO</div>';
    }
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;">';
    recibos.forEach((recibo, idx) => {
      const monto = recibo.amount || recibo.installmentAmount || '';
      const fecha = recibo.date || recibo.uploadedAt || '';
      const url = recibo.downloadURL || (recibo.receipt && recibo.receipt.downloadURL) || '';
      const nombre = participante.name || '';
      const numero = participante.number !== undefined ? participante.number : '';
      html += `<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;min-width:260px;max-width:320px;box-shadow:0 2px 8px #0001;'>
        <div style='font-weight:bold;color:#2563eb;font-size:1.1rem;margin-bottom:6px;'>Desprendible #${idx + 1}</div>
        <div><strong>Nombre:</strong> ${nombre}</div>
        <div><strong>Número:</strong> ${numero}</div>
        <div><strong>Monto:</strong> $${monto ? monto.toLocaleString('es-CO') : ''} COP</div>
        <div><strong>Fecha:</strong> ${fecha ? new Date(fecha).toLocaleString('es-CO') : ''}</div>
        <div><strong>Recibo:</strong> ${url ? `<a href='${url}' target='_blank'>Ver imagen</a>` : 'No disponible'}</div>
      </div>`;
    });
    html += '</div>';
    abonosRealizados.innerHTML = html;
  }

  if (formIdentificar) {
    formIdentificar.addEventListener('submit', async function(e) {
      e.preventDefault();
      abonoMsg.style.display = 'none';
      abonosRealizados.innerHTML = '';
      formAbono.style.display = 'none';
      document.getElementById('infoParticipante').style.display = 'none';
      const identificador = document.getElementById('identificador').value.trim();
      if (!identificador) return;
      abonosRealizados.innerHTML = 'Buscando...';
      const participante = await buscarParticipante(identificador);
      if (!participante) {
        abonosRealizados.innerHTML = '';
        abonoMsg.style.display = 'block';
        abonoMsg.textContent = 'No se encontró un participante con ese email, teléfono o número.';
        return;
      }
      participanteActual = participante;
      mostrarInfoParticipante(participante);
      mostrarAbonos(participante);
      // Lógica para monto por defecto
      const abonoMontoInput = document.getElementById('abonoMonto');
      if (abonoMontoInput) {
        let monto = '';
        let plan = participante.paymentPlan;
        if (plan && plan.totalAmount && (plan.selectedInstallments || plan.installments)) {
          const cuotas = plan.selectedInstallments || plan.installments;
          monto = Math.ceil(plan.totalAmount / cuotas);
        }
        abonoMontoInput.value = monto ? monto.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true }).replace(/^\$/, '') : '';
        abonoMontoInput.placeholder = 'Monto del abono';

        // Formatear como moneda colombiana (sin $) al perder el foco
        abonoMontoInput.addEventListener('blur', function() {
          let val = abonoMontoInput.value.replace(/[^\d.]/g, '');
          let num = parseFloat(val);
          if (!isNaN(num) && num > 0) {
            abonoMontoInput.value = num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: true }).replace(/^\$/, '');
          } else {
            abonoMontoInput.value = '';
          }
        });
        // Al enfocar, mostrar solo el número
        abonoMontoInput.addEventListener('focus', function() {
          let val = abonoMontoInput.value.replace(/[^\d.]/g, '');
          let num = parseFloat(val);
          abonoMontoInput.value = !isNaN(num) && num > 0 ? num : '';
        });
      }

      // Elimina el formateo automático en blur/focus
      if (abonoMontoInput) {
        abonoMontoInput.onblur = null;
        abonoMontoInput.onfocus = null;
      }

      formAbono.style.display = 'flex';
    });
  }

  if (formAbono) {
    formAbono.addEventListener('submit', async function(e) {
      e.preventDefault();
      const abonoMontoInput = document.getElementById('abonoMonto');
      const abonoReciboInput = document.getElementById('abonoRecibo');
      let monto = 0;
      if (abonoMontoInput) {
        let val = abonoMontoInput.value.replace(/[^\d.]/g, '');
        monto = parseFloat(val);
      }
      if (!participanteActual) {
        abonoMsg.style.display = 'block';
        abonoMsg.textContent = 'Error: Participante no identificado.';
        return;
      }
      if (!abonoReciboInput || !abonoReciboInput.files[0]) {
        abonoMsg.style.display = 'block';
        abonoMsg.textContent = 'Por favor selecciona un archivo de recibo.';
        return;
      }
      abonoMsg.style.display = 'block';
      abonoMsg.textContent = 'Subiendo recibo...';
      let reciboData = null;
      try {
        // Usa la lógica de paymentService si existe
        if (window.PaymentService && PaymentService.prototype.uploadReceiptToCloudinary) {
          const paymentService = new PaymentService();
          reciboData = await paymentService.uploadReceiptToCloudinary(abonoReciboInput.files[0], participanteActual);
        } else {
          // Lógica directa de subida a Cloudinary (usa tu preset real)
          const formData = new FormData();
          formData.append('file', abonoReciboInput.files[0]);
          formData.append('upload_preset', 'rifa_receipts');
          const res = await fetch('https://api.cloudinary.com/v1_1/dbvwqrkws/image/upload', {
            method: 'POST',
            body: formData
          });
          if (!res.ok) {
            const errorText = await res.text();
            console.error('Cloudinary error:', errorText);
            throw new Error('Cloudinary: ' + errorText);
          }
          const data = await res.json();
          reciboData = {
            downloadURL: data.secure_url,
            originalName: abonoReciboInput.files[0].name,
            uploadedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        abonoMsg.textContent = 'Error subiendo el recibo: ' + err.message;
        return;
      }
      abonoMsg.textContent = 'Guardando abono...';
      try {
        const firebaseService = new window.FirebaseService();
        let updatedParticipant = { ...participanteActual };
        const now = new Date().toISOString();
        // Estructura del abono
        const nuevoAbono = {
          amount: monto,
          date: now,
          receipt: reciboData
        };
        // Si tiene plan de pago fraccionado
        if (updatedParticipant.paymentPlan && Array.isArray(updatedParticipant.paymentPlan.paymentSchedule)) {
          // Buscar la próxima cuota pendiente
          const schedule = updatedParticipant.paymentPlan.paymentSchedule;
          const nextIdx = schedule.findIndex(q => q.status !== 'paid');
          if (nextIdx === -1) {
            abonoMsg.textContent = '¡Todas las cuotas ya están pagadas!';
            return;
          }
          // Marca la cuota como pagada y guarda el recibo
          schedule[nextIdx].status = 'paid';
          schedule[nextIdx].receipt = reciboData;
          schedule[nextIdx].paidAt = now;
          // Actualiza progreso
          updatedParticipant.paymentPlan.paidAmount = (updatedParticipant.paymentPlan.paidAmount || 0) + monto;
          updatedParticipant.paymentPlan.remainingAmount = (updatedParticipant.paymentPlan.totalAmount || 0) - updatedParticipant.paymentPlan.paidAmount;
          updatedParticipant.paymentPlan.currentInstallment = nextIdx + 2; // +1 porque es índice, +1 para la próxima
          // Agrega el recibo al array receipts
          if (!Array.isArray(updatedParticipant.paymentPlan.receipts)) {
            updatedParticipant.paymentPlan.receipts = [];
          }
          updatedParticipant.paymentPlan.receipts.push(nuevoAbono);
        } else {
          // Si es pago único, guarda en receiptFile
          updatedParticipant.receiptFile = {
            ...reciboData,
            amount: monto,
            date: now
          };
        }
        await firebaseService.updateParticipant(updatedParticipant.id, removeUndefined(updatedParticipant));
        abonoMsg.textContent = '✅ ¡Abono guardado exitosamente!';
        // Refresca la lista de abonos
        mostrarAbonos(updatedParticipant);
        formAbono.reset();
        participanteActual = updatedParticipant;
        setTimeout(() => {
          abonoMsg.style.display = 'none';
        }, 3000);
      } catch (err) {
        abonoMsg.textContent = 'Error guardando el abono: ' + err.message;
      }
    });
  }

  if (volverInicioBtn) {
    volverInicioBtn.addEventListener('click', function() {
      window.location.href = 'index.html';
    });
  }
}); 