import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const fxApi = createApi({
  reducerPath: 'fxApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Customer', 'Quote', 'Transaction', 'Rates', 'Health', 'Metrics'],
  endpoints: (builder) => ({

    // ── Health ────────────────────────────────────────────────────
    getHealth: builder.query({
      query: () => '/healthz',
      providesTags: ['Health'],
    }),

    // ── Metrics ───────────────────────────────────────────────────
    getMetrics: builder.query({
      query: () => '/metrics',
      providesTags: ['Metrics'],
    }),

    // ── Rates ─────────────────────────────────────────────────────
    getRates: builder.query({
      query: () => '/rates',
      providesTags: ['Rates'],
    }),
    refreshRates: builder.mutation({
      query: () => ({ url: '/rates/refresh', method: 'POST' }),
      invalidatesTags: ['Rates'],
    }),

    // ── Customers ─────────────────────────────────────────────────
    getCustomers: builder.query({
      query: () => '/customers',
      providesTags: ['Customer'],
    }),
    getCustomer: builder.query({
      query: (id) => `/customers/${id}`,
      providesTags: (result, error, id) => [{ type: 'Customer', id }],
    }),
    getCustomerBalances: builder.query({
      query: (id) => `/customers/${id}/balances`,
      providesTags: (result, error, id) => [{ type: 'Customer', id }],
    }),
    createCustomer: builder.mutation({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    creditBalance: builder.mutation({
      query: ({ customerId, ...body }) => ({
        url: `/customers/${customerId}/credit`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Customer'],
    }),

    // ── Quotes ────────────────────────────────────────────────────
    getQuotes: builder.query({
      query: (customerId) =>
        customerId ? `/quotes?customer_id=${customerId}` : '/quotes',
      providesTags: ['Quote'],
    }),
    getQuote: builder.query({
      query: (id) => `/quotes/${id}`,
      providesTags: (result, error, id) => [{ type: 'Quote', id }],
    }),
    generateQuote: builder.mutation({
      query: (body) => ({ url: '/quotes', method: 'POST', body }),
      invalidatesTags: ['Quote'],
    }),
    executeQuote: builder.mutation({
      query: ({ quoteId, customerId, idempotencyKey }) => ({
        url: `/quotes/${quoteId}/execute`,
        method: 'POST',
        body: { customer_id: customerId },
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      }),
      invalidatesTags: ['Quote', 'Transaction', 'Customer'],
    }),

    // ── Transactions ──────────────────────────────────────────────
    getTransactions: builder.query({
      query: (customerId) =>
        customerId ? `/transactions?customer_id=${customerId}` : '/transactions',
      providesTags: ['Transaction'],
    }),
    getTransaction: builder.query({
      query: (id) => `/transactions/${id}`,
      providesTags: (result, error, id) => [{ type: 'Transaction', id }],
    }),
  }),
})

export const {
  useGetHealthQuery,
  useGetMetricsQuery,
  useGetRatesQuery,
  useRefreshRatesMutation,
  useGetCustomersQuery,
  useGetCustomerQuery,
  useGetCustomerBalancesQuery,
  useCreateCustomerMutation,
  useCreditBalanceMutation,
  useGetQuotesQuery,
  useGetQuoteQuery,
  useGenerateQuoteMutation,
  useExecuteQuoteMutation,
  useGetTransactionsQuery,
  useGetTransactionQuery,
} = fxApi