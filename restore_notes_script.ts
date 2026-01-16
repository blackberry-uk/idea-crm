import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const backup = [
        {
            id: 'cmk8da2i40003oyd6tksmopyj',
            content: 'Discussed the project at lenght with @Daniel Mora '
        },
        {
            id: 'cmk8yji0m0001z5cvmxirt8q8',
            content: 'Hello @dann testing user tag notification'
        },
        {
            id: 'cmk9wi44e0001t4r3yi7r67sw',
            content: 'yes @Test Contact Fix '
        },
        {
            id: 'cmkc7842x0001kje71m3tz7va',
            content: '{"template":"call-minute","attendees":"Daniel Mora, Fernando Mora","segments":[{"type":"To do","topic":"Review requirements","comments":"@Fernando agreed to be responsible for reviewing requirements. Line 23 of this G-Doc\\n\\nhttps://docs.google.com/spreadsheets/d/1EDb5dEgoovC4e40ul58HDO5M7GamSLwvP-5nEDN5gIc/edit?gid=0#gid=0"}]}'
        },
        {
            id: 'cmkckyiew0001az96c8mmei5n',
            content: 'Yes discussed with @Fernando Mora '
        },
        {
            id: 'cmkf3i2tn000lmeran8qquch0',
            content: `Interactions with Sushil:
- Sushil is one of the early Hult agents in India. Hult was the first American school they represented, back in 2007-2008 
- Sushil Attended Hult Prize at the invitation of @Elie Nencheva, in several occasions.
- Met with Sushil's son (Tushar) - had lunch in London, near PG campus in 2024
- Visited Sushil in Mumbai in 2024
- Ran into @Sushil Sukhwani at San Diego NAFSA conference June 2025
- Visited @Sushil Sukhwani again in Mumbai in November 2025
- Had a call with @Sushil Sukhwani about a potential sale on 24th December 2025`
        },
        {
            id: 'cmkej2sek0009qhryga6w50lx',
            content: 'Hello herman@s!!'
        },
        {
            id: 'cmkf4m3nt0001wz799tywqr77',
            content: `{"template":"call-minute","date":"2025-12-24","attendees":"Sushil Sukhwani, Fernando Mora","segments":[{"type":"Reference","topic":"Previous Negotiation fell off","comments":"@Sushil Sukhwani  mentioned that he had postponed this call because he had been negotiating with a potential acquirer who wasn't willing to pay the price he wants.\\n\\nMost valuators choose EBITDA as the price-setter, but unfortunately Edwise has been subject to an extraordinary disruption of the market (Trump) and last year's numbers are not sufficient to capture the true value of the enterprise."},{"type":"Data Point","topic":"Asking price","comments":"Sushil wants 10x on a 3-year EBITDA average\\n\\nEdwise 3YA EBITDA is 33 crore INR, with a profit margin of 45%\\nTopline revenue for 3YA is 75 to 80 crore INR\\n\\nExtrapolation is Sushil wants 330 crore (36.5 million dollars)"},{"type":"Insight","topic":"Litigation","comments":"@Sushil Sukhwani is embroiled in a problematic dispute with his brother about ownership of Edwise.\\n\\nThe only way he can settle this is by obtaining liquid exit for the enterprise value, rather than splitting the company in ways that don't make sense."},{"type":"Data Point","topic":"Average revenue per customer","comments":"Edwise makes on average $3000 per customer (2.7 Lakh)\\n\\nExtrapolation 3YA means  2,500 students per year. \\n\\n2025 ended 25% down vs. 2024 - need to do an estimation of volume"},{"type":"Insight","topic":"Leaner Business Model","comments":"Edwise is able to outperform the market in terms of profitability thanks to @Sushil Sukhwani smart use of his workforce. \\n\\nSaturdays are the best days of the week. Competitors treat Saturdays as exceptional days to work. For Edwise, Saturdays are mandatory and there's a way that you can start to claim them back as you earn seniority\\n\\nWhat this does is save Sushil a lot of money in terms of extra-staff to cover for Saturdays, hence his superior profitability."},{"type":"To do","topic":"Investment Memo","comments":"@Fernando Mora will begin working on a draft of a document that could be used for investors"}]}`
        }
    ];

    for (const item of backup) {
        await prisma.note.update({
            where: { id: item.id },
            data: { content: item.content }
        });
    }

    console.log('Restored notes from backup.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
