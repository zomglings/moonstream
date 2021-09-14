import React, {
  useRef,
  useEffect,
  useContext,
  useState,
  useCallback,
} from "react";
import {
  Flex,
  Spinner,
  Button,
  Center,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  IconButton,
  Input,
  Select,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Tag,
  TagLabel,
  TagCloseButton,
  Stack,
  Spacer,
} from "@chakra-ui/react";
import { useSubscriptions } from "../core/hooks";
import StreamEntry from "./StreamEntry";
import UIContext from "../core/providers/UIProvider/context";
import { FaFilter } from "react-icons/fa";
import useStream from "../core/hooks/useStream";
import { ImCancelCircle } from "react-icons/im";
import { previousEvent } from "../core/services/stream.service";
import { useQueryClient } from "react-query";
import { PAGE_SIZE } from "../core/constants";

const FILTER_TYPES = {
  ADDRESS: 0,
  GAS: 1,
  GAS_PRICE: 2,
  AMOUNT: 3,
  HASH: 4,
  DISABLED: 99,
};
const DIRECTIONS = { SOURCE: "from", DESTINATION: "to" };
const CONDITION = {
  EQUAL: 0,
  CONTAINS: 1,
  LESS: 2,
  LESS_EQUAL: 3,
  GREATER: 4,
  GREATER_EQUAL: 5,
  NOT_EQUAL: 6,
};

const EntriesNavigation = () => {
  const ui = useContext(UIContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { subscriptionsCache } = useSubscriptions();
  const [initialized, setInitialized] = useState(false);
  const [entries, setEntries] = useState([]);
  const [newFilterState, setNewFilterState] = useState([
    {
      type: FILTER_TYPES.ADDRESS,
      direction: DIRECTIONS.SOURCE,
      condition: CONDITION.EQUAL,
      value: null,
    },
  ]);
  const [filterState, setFilterState] = useState([]);
  const queryClient = useQueryClient();
  console.log(queryClient);
  const loadMoreButtonRef = useRef(null);

  const {
    events,
    eventsIsLoading,
    eventsRefetch,
    eventsIsFetching,
    setEvents,
    latestEventsRefetch,
    nextEventRefetch,
    previousEventRefetch,
    streamBoundary,
    setDefaultBoundary,
    loadOlderEvents,
    loadNewerEvents,
    cursor,
    setCursor,
  } = useStream(ui.searchTerm.q);

  useEffect(() => {
    if (!streamBoundary.start_time && !streamBoundary.end_time) {
      setDefaultBoundary();
    } else if (!initialized) {
      eventsRefetch();
      latestEventsRefetch();
      nextEventRefetch();
      previousEventRefetch();
      setInitialized(true);
    }
  }, [
    streamBoundary,
    initialized,
    setInitialized,
    setDefaultBoundary,
    eventsRefetch,
    latestEventsRefetch,
    nextEventRefetch,
    previousEventRefetch,
  ]);

  useEffect(() => {
    if (events) {
      setEntries(events);
    }
  }, [events]);

  const setFilterProps = useCallback(
    (filterIdx, props) => {
      const newFilterProps = [...newFilterState];
      newFilterProps[filterIdx] = { ...newFilterProps[filterIdx], ...props };
      setNewFilterState(newFilterProps);
    },
    [newFilterState, setNewFilterState]
  );

  useEffect(() => {
    if (
      subscriptionsCache.data?.subscriptions[0]?.id &&
      newFilterState[0]?.value === null
    ) {
      setFilterProps(0, {
        value: subscriptionsCache?.data?.subscriptions[0]?.address,
      });
    }
  }, [subscriptionsCache, newFilterState, setFilterProps]);

  useEffect(() => {
    if (cursor >= events.length + 2 * PAGE_SIZE) {
      loadOlderEvents();
      previousEventRefetch();
    }
  }, [events, cursor]);

  const canCreate = false;

  const canDelete = false;

  const dropNewFilterArrayItem = (idx) => {
    const oldArray = [...newFilterState];

    const newArray = oldArray.filter(function (ele) {
      return ele != oldArray[idx];
    });
    setNewFilterState(newArray);
  };

  const dropFilterArrayItem = (idx) => {
    const oldArray = [...filterState];
    const newArray = oldArray.filter(function (ele) {
      return ele != oldArray[idx];
    });

    setFilterState(newArray);
    setNewFilterState(newArray);
    ui.setSearchTerm(
      newArray
        .map((filter) => {
          return filter.direction + ":" + filter.value;
        })
        .join("+")
    );
  };

  const handleFilterSubmit = () => {
    setFilterState(newFilterState);
    ui.setSearchTerm(
      newFilterState
        .map((filter) => {
          return filter.direction + ":" + filter.value;
        })
        .join("+")
    );
    onClose();
  };

  const handleAddressChange = (idx) => (e) => {
    setFilterProps(idx, { value: e.target.value });
  };

  const handleConditionChange = (idx) => (e) => {
    setFilterProps(idx, { condition: parseInt(e.target.value) });
  };

  const handleFilterStateCallback = (props) => {
    const currentFilterState = [...filterState];
    currentFilterState.push({ ...props });

    ui.setSearchTerm(
      currentFilterState
        .map((filter) => {
          return filter.direction + ":" + filter.value;
        })
        .join("+")
    );

    setFilterState(currentFilterState);
  };
  if (subscriptionsCache.isLoading) return "";

  return (
    <Flex
      id="JournalNavigation"
      height="100%"
      maxH="100%"
      overflow="hidden"
      direction="column"
      flexGrow={1}
    >
      {entries && !eventsIsLoading ? (
        <>
          <Drawer onClose={onClose} isOpen={isOpen} size="lg">
            <DrawerOverlay />
            <DrawerContent bgColor="gray.100">
              <DrawerCloseButton />
              <DrawerHeader>{`Filter results`}</DrawerHeader>
              <DrawerBody>
                <Text pt={2} fontWeight="600">
                  Source:
                </Text>
                {newFilterState.map((filter, idx) => {
                  if (filter.type === FILTER_TYPES.DISABLED) return "";
                  return (
                    <Flex
                      key={`subscription-filter-item-${idx}`}
                      direction="column"
                    >
                      <Flex
                        mt={4}
                        direction="row"
                        flexWrap="nowrap"
                        placeItems="center"
                        bgColor="gray.300"
                        borderRadius="md"
                      >
                        {filter.type === FILTER_TYPES.ADDRESS && (
                          <>
                            <Flex w="120px" placeContent="center">
                              {filter.direction === DIRECTIONS.SOURCE
                                ? `From:`
                                : `To:`}
                            </Flex>
                            <Select
                              pr={2}
                              w="180px"
                              onChange={handleConditionChange(idx)}
                            >
                              <option value={CONDITION.EQUAL}>Is</option>
                              <option value={CONDITION.NOT_EQUAL}>
                                Is not
                              </option>
                            </Select>
                            {filter.direction === DIRECTIONS.SOURCE && (
                              <Select
                                variant="solid"
                                colorScheme="primary"
                                name="address"
                                onChange={handleAddressChange(idx)}
                              >
                                {!subscriptionsCache.isLoading &&
                                  subscriptionsCache?.data?.subscriptions.map(
                                    (subscription, idx) => {
                                      return (
                                        <option
                                          value={subscription.address}
                                          key={`subscription-filter-item-${idx}`}
                                        >
                                          {`${
                                            subscription.label
                                          } - ${subscription.address.slice(
                                            0,
                                            5
                                          )}...${subscription.address.slice(
                                            -3
                                          )}`}
                                        </option>
                                      );
                                    }
                                  )}
                              </Select>
                            )}
                            {filter.direction === DIRECTIONS.DESTINATION && (
                              <Input
                                type="text"
                                onChange={(e) =>
                                  setFilterProps(idx, {
                                    value: e.target.value,
                                  })
                                }
                                placeholder="Type in address"
                              />
                            )}
                          </>
                        )}
                        <IconButton
                          placeItems="center"
                          colorScheme="primary"
                          variant="ghost"
                          onClick={() => dropNewFilterArrayItem(idx)}
                          icon={<ImCancelCircle />}
                        />
                      </Flex>
                    </Flex>
                  );
                })}
                <Menu>
                  <MenuButton
                    as={Button}
                    mt={4}
                    colorScheme="secondary"
                    variant="solid"
                  >
                    Add filter row
                  </MenuButton>
                  <MenuList>
                    <MenuGroup title="source"></MenuGroup>
                    <MenuItem
                      onClick={() =>
                        setNewFilterState([
                          ...newFilterState,
                          {
                            type: FILTER_TYPES.ADDRESS,
                            direction: DIRECTIONS.SOURCE,
                            condition: CONDITION.EQUAL,
                            value:
                              subscriptionsCache?.data?.subscriptions[0]
                                ?.address,
                          },
                        ])
                      }
                    >
                      Source
                    </MenuItem>
                    <MenuItem
                      onClick={() =>
                        setNewFilterState([
                          ...newFilterState,
                          {
                            type: FILTER_TYPES.ADDRESS,
                            direction: DIRECTIONS.DESTINATION,
                            condition: CONDITION.EQUAL,
                            value:
                              subscriptionsCache?.data?.subscriptions[0]
                                ?.address,
                          },
                        ])
                      }
                    >
                      Destination
                    </MenuItem>
                  </MenuList>
                </Menu>
              </DrawerBody>
              <DrawerFooter pb={16} placeContent="center">
                <Button
                  colorScheme="suggested"
                  variant="solid"
                  // type="submit"
                  onClick={() => handleFilterSubmit()}
                >
                  Apply selected filters
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <Flex h="3rem" w="100%" bgColor="gray.100" alignItems="center">
            <Flex maxW="90%">
              {filterState.map((filter, idx) => {
                if (filter.type === FILTER_TYPES.DISABLED) return "";
                return (
                  <Tag
                    key={`filter-badge-display-${idx}`}
                    mx={1}
                    size="lg"
                    variant="solid"
                    colorScheme="secondary"
                  >
                    {filter?.type === FILTER_TYPES.ADDRESS && (
                      <TagLabel>
                        {filter.condition === CONDITION.NOT_EQUAL && "Not "}
                        {filter.direction === DIRECTIONS.SOURCE
                          ? "From: "
                          : "To: "}
                        {subscriptionsCache?.data?.subscriptions.find(
                          (subscription) =>
                            subscription.address === filter.value
                        )?.label ?? filter.value}
                      </TagLabel>
                    )}

                    <TagCloseButton onClick={() => dropFilterArrayItem(idx)} />
                  </Tag>
                );
              })}
            </Flex>
            <Spacer />
            <IconButton
              mr={4}
              onClick={onOpen}
              colorScheme="primary"
              variant="ghost"
              icon={<FaFilter />}
            />
          </Flex>

          <Flex
            className="ScrollableWrapper"
            w="100%"
            overflowY="hidden"
            h="calc(100% - 3rem)"
          >
            <Flex
              className="Scrollable"
              id="StreamEntry"
              overflowY="scroll"
              direction="column"
              w="100%"
              //onScroll={(e) => handleScroll(e)}
            >
              <Stack direction="row" justifyContent="space-between">
                {!eventsIsFetching ? (
                  <Button
                    onClick={() => {
                      loadNewerEvents();
                      nextEventRefetch();
                    }}
                    variant="outline"
                    colorScheme="suggested"
                  >
                    Load newer events
                  </Button>
                ) : (
                  <Button
                    isLoading
                    loadingText="Loading"
                    variant="outline"
                    colorScheme="suggested"
                  ></Button>
                )}
              </Stack>
              {entries.map((entry, idx) => (
                <StreamEntry
                  showOnboardingTooltips={false}
                  key={`entry-list-${idx}`}
                  entry={entry}
                  disableDelete={!canDelete}
                  disableCopy={!canCreate}
                  filterCallback={handleFilterStateCallback}
                  filterConstants={{ DIRECTIONS, CONDITION, FILTER_TYPES }}
                />
              ))}
              {previousEvent && !eventsIsFetching ? (
                <Center>
                  <Button
                    onClick={() => {
                      if (
                        queryClient.getQueryData("stream-events").length >
                        cursor + 2 * PAGE_SIZE
                      ) {
                        setEvents(
                          queryClient
                            .getQueryData(["stream-events"])
                            .slice(
                              cursor + PAGE_SIZE - 1,
                              cursor + 2 * PAGE_SIZE
                            )
                        );
                        setCursor(cursor + PAGE_SIZE);
                      } else {
                        setEvents(
                          queryClient
                            .getQueryData(["stream-events"])
                            .slice(
                              cursor + PAGE_SIZE - 1,
                              queryClient.getQueryData(["stream-events"]).length
                            )
                        );
                        setCursor(cursor + PAGE_SIZE);
                      }
                    }}
                    variant="outline"
                    colorScheme="suggested"
                  >
                    Load older events
                  </Button>
                </Center>
              ) : (
                <Center>
                  {!eventsIsFetching ? (
                    "Тransactions not found. You can subscribe to more addresses in Subscriptions menu."
                  ) : (
                    <Button
                      isLoading
                      loadingText="Loading"
                      variant="outline"
                      colorScheme="suggested"
                    ></Button>
                  )}
                </Center>
              )}
              {streamBoundary.previous_event_time && eventsIsLoading ? (
                <Center>
                  <Spinner
                    //hidden={!isFetchingMore}
                    ref={loadMoreButtonRef}
                    my={8}
                    size="lg"
                    color="primary.500"
                    thickness="4px"
                    speed="1.5s"
                  />
                </Center>
              ) : (
                ""
              )}
            </Flex>
          </Flex>
        </>
      ) : (
        <Center>
          <Spinner
            mt="50%"
            size="lg"
            color="primary.500"
            thickness="4px"
            speed="1.5s"
          />
        </Center>
      )}
    </Flex>
  );
};

export default EntriesNavigation;
