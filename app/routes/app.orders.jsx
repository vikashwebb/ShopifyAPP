import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Page, Card, DataTable } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      orders(first: 10) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            displayFinancialStatus
            
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `);

  const responseJson = await response.json();
  const orders = responseJson.data.orders.edges.map((edge) => ({
    id: edge.node.id,
    name: edge.node.name,
    customer: edge.node.customer
      ? `${edge.node.customer.firstName || ""} ${edge.node.customer.lastName || ""}`.trim()
      : "N/A",
    total: `$${edge.node.totalPriceSet.shopMoney.amount} ${edge.node.totalPriceSet.shopMoney.currencyCode}`,
    status: edge.node.displayFinancialStatus,
    fulfillment: edge.node.fulfillmentStatus || "Unfulfilled",
    createdAt: new Date(edge.node.createdAt).toLocaleDateString(),
    lineItems: edge.node.lineItems.edges
      .map((item) => `${item.node.title} (x${item.node.quantity})`)
      .join(", "),
  }));

  return { orders };
};

export default function OrdersPage() {
  const fetcher = useFetcher();
  const ordersData = fetcher.data?.orders || [];

  useEffect(() => {
    fetcher.submit({}, { method: "POST" });
  }, []);

  return (
    <Page>
      <TitleBar title="Orders Page" />
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
          headings={[
            "Order ID",
            "Customer",
            "Total",
            "Status",
            "Fulfillment",
            "Created Date",
            "Line Items",
          ]}
          rows={ordersData.map((order) => [
            order.name,
            order.customer,
            order.total,
            order.status,
            order.fulfillment,
            order.createdAt,
            order.lineItems,
          ])}
        />
      </Card>
    </Page>
  );
}
