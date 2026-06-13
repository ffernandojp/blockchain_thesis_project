describe('Validación de la Estrategia Offline-First (Conectividad Rural)', () => {
    
    beforeEach(() => {
        // Interceptar API de Mis Lotes para que la carga inicial sea rápida y sin errores
        cy.intercept('GET', '**/api/lotes/mis-lotes', {
            statusCode: 200,
            body: { success: true, data: [] }
        }).as('misLotes');

        cy.visit('http://localhost:3030/public/index.html');
        
        // Desregistrar Service Workers viejos antes de cada prueba
        cy.window().then(win => {
            if (win.navigator && win.navigator.serviceWorker) {
                win.navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (let registration of registrations) {
                        registration.unregister();
                    }
                });
            }
        });

        cy.wait(500); // Dar tiempo a que IndexedDB se inicialice en app.js
    });

    it('Debe guardar el payload en IndexedDB cuando está offline y sincronizar al volver online', () => {
        // 1. Iniciar sesión forzando el localStorage y ejecutando la UI
        cy.window().then((win) => {
            win.localStorage.setItem('agtech_token', 'mock_token');
            win.localStorage.setItem('agtech_role', 'Productor Agrícola');
            if (typeof win.evaluarPantalla === 'function') {
                win.evaluarPantalla();
            }
        });

        // Esperar un momento a que el DOM esté listo
        cy.wait(1000);
        
        cy.get('body').then($body => {
            cy.writeFile('cypress_logs.txt', $body.html());
        });

        // Verificar que el panel de registro está visible
        cy.get('#registro-panel', { timeout: 10000 }).should('be.visible');

        // 2. Llenar el formulario de registro de cosecha
        cy.get('#renspa').type('01.002.0.00345/00', { force: true });
        cy.get('#volumen').type('30', { force: true });
        
        // 3. Simular la desconexión de red (Modo Campo)
        cy.intercept('POST', '**/api/lotes/registrar', { forceNetworkError: true }).as('postRegistroOffline');
        
        cy.window().then((win) => {
            // Mockear geolocalización para que sea instantánea
            if (win.navigator.geolocation) {
                cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((cb) => {
                    return cb({ coords: { latitude: -34.6, longitude: -58.4 } });
                });
            }

            // Forzar offline
            win.localStorage.setItem('forceOffline', 'true');
            win.dispatchEvent(new win.Event('offline'));
        });

        // 4. Presionar "Registrar" y verificar que no hay timeout, sino guardado local
        cy.get('#btn-registrar').click({ force: true });

        // Ver los logs
        // Ver los logs
        cy.wait(500); // Dar tiempo a guardarOffline()
        cy.get('body').then($body => {
            cy.writeFile('cypress_logs.txt', $body.html());
        });

        // 5. Verificar que los datos están realmente en IndexedDB
        cy.window().then((win) => {
            return new Cypress.Promise((resolve, reject) => {
                const req = win.indexedDB.open('AgTechDB', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('lotes_pendientes')) {
                        db.createObjectStore('lotes_pendientes', { keyPath: 'idLote' });
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    try {
                        const tx = db.transaction('lotes_pendientes', 'readonly');
                        const store = tx.objectStore('lotes_pendientes');
                        const countReq = store.count();
                        countReq.onsuccess = () => {
                            expect(countReq.result).to.equal(1);
                            resolve();
                        };
                    } catch (err) {
                        reject(err);
                    }
                };
            });
        });

        // 6. Restaurar la conexión (Background Sync o Fallback disparado)
        cy.intercept('POST', '**/api/lotes/registrar', {
            statusCode: 201,
            body: { success: true, data: { id: "0x123", estado: "COSECHADO" } }
        }).as('postRegistroOnline');

        cy.window().then((win) => {
            win.localStorage.removeItem('forceOffline');
            if (win.updateOnlineStatus) win.updateOnlineStatus();
        });

        // Verificar Toast de restauración
        // cy.get('.toast.success').should('contain', 'Conexión restaurada');

        // Esperar que la sincronización en segundo plano o fallback haga la petición HTTP
        cy.wait('@postRegistroOnline').then((interception) => {
            // interception.request.body es un FormData (multipart/form-data), puede ser String o Buffer en Cypress
            const bodyStr = typeof interception.request.body === 'string' ? interception.request.body : new TextDecoder().decode(interception.request.body);
            expect(bodyStr).to.include('30');
            expect(bodyStr).to.include('01.002.0.00345/00');
        });

        // Verificar que el Toast de éxito final aparece
        // cy.get('.toast.success').should('contain', 'sincronizado con éxito');

        // 7. Verificar que IndexedDB se vació (Background Sync completado)
        cy.wait(500); // Dar tiempo a vaciar IndexedDB
        cy.window().then((win) => {
            return new Cypress.Promise((resolve, reject) => {
                const req = win.indexedDB.open('AgTechDB', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('lotes_pendientes')) {
                        db.createObjectStore('lotes_pendientes', { keyPath: 'idLote' });
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    try {
                        const tx = db.transaction('lotes_pendientes', 'readonly');
                        const store = tx.objectStore('lotes_pendientes');
                        const countReq = store.count();
                        countReq.onsuccess = () => {
                            expect(countReq.result).to.equal(0);
                            resolve();
                        };
                    } catch (err) {
                        reject(err);
                    }
                };
            });
        });
    });
});
