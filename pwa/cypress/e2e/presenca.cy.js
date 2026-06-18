describe('Fluxo Principal do PWA', () => {
  it('Deve carregar a página inicial corretamente', () => {
    cy.visit('/')
    cy.contains('AILAB Presença')
    cy.contains('Gerenciar')
    cy.contains('+ Cadastrar')
  })
})
