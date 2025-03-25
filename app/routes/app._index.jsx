import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  FormLayout,
  TextField,
  InlineError,
  ChoiceList,
  Modal,
  DataTable,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      shop {
        name
        id
        email
        primaryDomain {
          host
        }
        billingAddress {
          address1
          address2
          city
          province
          country
          zip
        }
      }
    }
  `);

  const responseJson = await response.json();

  const shopDetails = {
    name: responseJson.data.shop.name,
    id: responseJson.data.shop.id,
    email: responseJson.data.shop.email,
    primaryDomain: responseJson.data.shop.primaryDomain.host,
    billingAddress: responseJson.data.shop.billingAddress || {},
  };

  return { shopDetails, responseJson };
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const shopDetails = fetcher.data?.shopDetails || {};
  const responseJson = fetcher.data?.responseJson || [];

  useEffect(() => {
    fetcher.submit({}, { method: "POST" });
  }, []);

  const [formData, setFormData] = useState({
    channel_id:
      "631ef8e42182a182d5e42e8fde2bb2a3f9bdb40d2124fbc64784e423b36d08c0",
    channel_name: "",
  });

  const [syncSettings, setSyncSettings] = useState({
    appStatus: "disabled",
    orderSync: "disabled",
    pullOrderStatus: "disabled",
    cancelOrderSync: "disabled",
    disableAll: false,
  });

  const [errors, setErrors] = useState({
    channel_name: "",
    apiError: "",
  });

  const [channelDetails, setChannelDetails] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Pass only shop details to shopify-login endpoint
  const validateChannel = async () => {
    setErrors({ ...errors, apiError: "" });

    if (!shopDetails.name) {
      setErrors({ ...errors, apiError: "Shop details not loaded yet." });
      return;
    }

    try {
      const payload = {
        channel_id: formData.channel_id,
        channel_name: formData.channel_name,
        shop_details: shopDetails,
      };

      const response = await fetch(
        `https://connect.gaintlogistic.com/v1/merchant/shopify-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      console.log("Shopify Login Response:", result);

      if (result.s === 1) {
        shopify.toast.show("Channel validated and details passed successfully!");
        setErrors({ ...errors, apiError: "" });
        setSyncSettings((prev) => ({ ...prev, disableAll: false }));
        setChannelDetails(result.data || result);
      } else {
        setErrors({ ...errors, apiError: result.msg || "Operation failed!" });
      }
    } catch (error) {
      setErrors({ ...errors, apiError: "Error connecting to shopify-login." });
    }
  };

  // Remove pushOrders function since orders are not needed
  const syncOrders = () => {
    shopify.toast.show("Orders sync not implemented in this version.");
    setShowModal(true); // Still show modal if you want, but no order pushing
  };

  return (
    <Page>
      <TitleBar title="Gaint Logistics" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Validate Shopify Channel
                  </Text>
                  <fetcher.Form method="post">
                    <FormLayout>
                      <TextField
                        label="Channel ID"
                        value={formData.channel_id}
                        onChange={(value) =>
                          setFormData({ ...formData, channel_id: value })
                        }
                        autoComplete="off"
                        disabled={syncSettings.disableAll}
                      />
                      <TextField
                        label="Channel Name"
                        value={formData.channel_name}
                        onChange={(value) =>
                          setFormData({ ...formData, channel_name: value })
                        }
                        autoComplete="off"
                        error={errors.channel_name}
                        disabled={syncSettings.disableAll}
                      />
                      {errors.channel_name && (
                        <InlineError message={errors.channel_name} />
                      )}
                      {errors.apiError && (
                        <InlineError message={errors.apiError} />
                      )}
                      <Button
                        onClick={validateChannel}
                        disabled={
                          !formData.channel_id ||
                          !formData.channel_name ||
                          syncSettings.disableAll
                        }
                        primary
                      >
                        Validate
                      </Button>
                    </FormLayout>
                  </fetcher.Form>
                  {channelDetails && (
                    <Text as="p">
                      Channel Details: {JSON.stringify(channelDetails)}
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  App & Order Sync Settings
                </Text>
                <FormLayout>
                  <ChoiceList
                    title="App Status"
                    choices={[
                      { label: "Enable", value: "enabled" },
                      { label: "Disable", value: "disabled" },
                    ]}
                    selected={syncSettings.appStatus}
                    onChange={(value) =>
                      setSyncSettings({ ...syncSettings, appStatus: value })
                    }
                    disabled={syncSettings.disableAll}
                  />
                  <ChoiceList
                    title="Order Sync Live"
                    choices={[
                      { label: "Enable", value: "enabled" },
                      { label: "Disable", value: "disabled" },
                    ]}
                    selected={syncSettings.orderSync}
                    onChange={(value) =>
                      setSyncSettings({ ...syncSettings, orderSync: value })
                    }
                    disabled={syncSettings.disableAll}
                  />
                </FormLayout>
                <Button onClick={syncOrders} primary>
                  Sync Orders
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {showModal && (
        <Modal
          size="large"
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Order Sync"
          secondaryActions={[
            { content: "Close", onAction: () => setShowModal(false) },
          ]}
        >
          <Modal.Section>
            <Text as="p">Orders are not fetched in this version.</Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}