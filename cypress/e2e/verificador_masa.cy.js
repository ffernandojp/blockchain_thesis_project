describe('Verificador Público QR - Trazabilidad de Masa en Silos (Sección 6.2.5)', () => {

    it('Debe renderizar la cabecera enriquecida y el desglose porcentual exacto en lote mezclado (40% / 60%)', () => {
        cy.intercept('GET', '**/api/lotes/SILO-BAHIA-100', {
            statusCode: 200,
            body: {
                success: true,
                data: {
                    id: 'SILO-BAHIA-100',
                    estado: 'EXPORTADO',
                    renspa: 'ACOPIO_CENTRAL',
                    volumenToneladas: 100.0,
                    bfaHash: '3a8f9c1e7b2d5f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f1a',
                    tokenId: '1',
                    txHash: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
                    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
                    lotesOrigen: ['LOTE-AGRO-001', 'LOTE-AGRO-002'],
                    historialTransacciones: [
                        { accion: 'ACOPIO_Y_MEZCLA', fecha: '2026-09-08T14:00:00.000Z', detalles: 'Volumen consolidado: 100 TN' },
                        { accion: 'CAMBIO_ESTADO: EXPORTADO', fecha: '2026-09-08T18:00:00.000Z', detalles: 'NFT minteado. TX: 0x9a8b7c... - Token ID: #1' }
                    ],
                    desgloseOrigenes: [
                        {
                            id: 'LOTE-AGRO-001',
                            renspa: '01.002.0.00345/00',
                            volumenAportadoTN: 40.0,
                            porcentajeAporte: 40.0,
                            geolocalizacion: { lat: -34.6037, lng: -58.3816, formatted: 'Lat: -34.6037, Lon: -58.3816' },
                            ipfsCID: 'bafybeicarta001aaa',
                            fechaCosecha: '2026-09-08T10:00:00.000Z'
                        },
                        {
                            id: 'LOTE-AGRO-002',
                            renspa: '02.003.0.00789/00',
                            volumenAportadoTN: 60.0,
                            porcentajeAporte: 60.0,
                            geolocalizacion: { lat: -33.8912, lng: -60.5421, formatted: 'Lat: -33.8912, Lon: -60.5421' },
                            ipfsCID: 'bafybeicarta002bbb',
                            fechaCosecha: '2026-09-08T11:00:00.000Z'
                        }
                    ]
                }
            }
        }).as('getLoteMezclado');

        cy.visit('http://localhost:3030/public/verificador?id=SILO-BAHIA-100');
        cy.wait('@getLoteMezclado');

        // 1. Verificación de Cabecera
        cy.get('#lote-title').should('contain', 'SILO-BAHIA-100');
        cy.get('#lote-status-badge').should('contain', 'Lote Exportado');
        cy.get('#header-volumen').should('contain', '100.00 TN');
        cy.get('#header-bfa-time').should('be.visible');
        cy.get('#header-contract-container').should('contain', '0x5FbDB2315678afecb367f032d93F642f64180aa3');

        // 2. Verificación de Alerta de Fusión en Silos (Trazabilidad de Masa)
        cy.get('.commingling-alert-card').should('be.visible');
        cy.get('.commingling-title').should('contain', 'Lote Consolidado por Fusión en Silos (Trazabilidad de Masa)');

        // 3. Verificación de Lotes Precursores y Porcentajes
        cy.get('.origin-card').should('have.length', 2);

        // Precursor A (40%)
        cy.contains('.origin-card', 'LOTE-AGRO-001').within(() => {
            cy.contains('01.002.0.00345/00').should('be.visible');
            cy.contains('40.0% de la carga (40.00 TN)').should('be.visible');
            cy.get('.progress-bar-fill').should('have.attr', 'style').and('include', 'width: 40');
            cy.contains('Ver en Mapa').should('have.attr', 'href').and('include', 'openstreetmap.org');
            cy.contains('Ver Carta de Porte Original (IPFS)').should('have.attr', 'href').and('include', 'bafybeicarta001aaa');
        });

        // Precursor B (60%)
        cy.contains('.origin-card', 'LOTE-AGRO-002').within(() => {
            cy.contains('02.003.0.00789/00').should('be.visible');
            cy.contains('60.0% de la carga (60.00 TN)').should('be.visible');
            cy.get('.progress-bar-fill').should('have.attr', 'style').and('include', 'width: 60');
            cy.contains('Ver en Mapa').should('have.attr', 'href').and('include', 'openstreetmap.org');
            cy.contains('Ver Carta de Porte Original (IPFS)').should('have.attr', 'href').and('include', 'bafybeicarta002bbb');
        });
    });

    it('Debe renderizar la tarjeta única tradicional con 100% de aporte para lote monovarietal directo', () => {
        cy.intercept('GET', '**/api/lotes/LOTE-MONO-100', {
            statusCode: 200,
            body: {
                success: true,
                data: {
                    id: 'LOTE-MONO-100',
                    estado: 'ACONDICIONADO',
                    renspa: '05.006.0.00555/00',
                    volumenToneladas: 75.0,
                    bfaHash: null,
                    desgloseOrigenes: [
                        {
                            id: 'LOTE-MONO-100',
                            renspa: '05.006.0.00555/00',
                            volumenAportadoTN: 75.0,
                            porcentajeAporte: 100.0,
                            geolocalizacion: { lat: -35.1000, lng: -59.4000, formatted: 'Lat: -35.1000, Lon: -59.4000' },
                            ipfsCID: 'bafybeimono75aaa',
                            fechaCosecha: '2026-09-08T12:00:00.000Z'
                        }
                    ]
                }
            }
        }).as('getLoteMono');

        cy.visit('http://localhost:3030/public/verificador?id=LOTE-MONO-100');
        cy.wait('@getLoteMono');

        cy.get('#lote-title').should('contain', 'LOTE-MONO-100');
        cy.get('.commingling-alert-card').should('not.exist');
        cy.get('.origin-card').should('have.length', 1);
        cy.get('.origin-card').should('contain', '100.0% de la carga (75.00 TN)');
        cy.get('.origin-card').should('contain', '05.006.0.00555/00');
    });

});
