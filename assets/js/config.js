/* Napojení formulářů – jedno místo.
   Každý formulář se odešle (POST, FormData) na adresu níže. Prázdné pole = formulář se jen ověří a potvrdí (demo).
   Příklady: Formspree 'https://formspree.io/f/xxxx', Ecomail/Mailchimp endpoint, Tally webhook, vlastní WP endpoint. */
window.PRAGUE_BIO = {
  formEndpoints: {
    contact: '',      // stránka Contact
    membership: '',   // žádost o členství
    newsletter: ''    // odběr newsletteru (patička + News & Events)
  },
  pitchFormEndpoint: '',   // registrace projektu na konferenci
  recaptchaSiteKey: ''     // volitelné
};
