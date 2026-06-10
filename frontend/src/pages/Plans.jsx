import { useEffect, useState } from "react";

import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const emptyPlan = {
    plan_name: "",
    description: "",
    price: "",
    payment_type: "",
};

function Plans() {
    const [plans, setPlans] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] =
        useState(null);
    const [formData, setFormData] =
        useState(emptyPlan);

    const loadPlans = async () => {
        try {
            const response = await endpoints.plans.list();
            setPlans(toList(response.data));
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        let active = true;

        endpoints.plans
            .list()
            .then((response) => {
                if (active) {
                    setPlans(toList(response.data));
                }
            })
            .catch((error) => {
                console.error(error);
            });

        return () => {
            active = false;
        };
    }, []);

    const openCreateModal = () => {
        setEditingPlan(null);
        setFormData(emptyPlan);
        setShowModal(true);
    };

    const openEditModal = (plan) => {
        setEditingPlan(plan);
        setFormData({
            plan_name: plan.plan_name,
            description: plan.description,
            price: plan.price,
            payment_type: plan.payment_type,
        });
        setShowModal(true);
    };

    const updateFormData = (field, value) => {
        setFormData((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            if (editingPlan) {
                await endpoints.plans.update(
                    editingPlan.id,
                    formData
                );
            } else {
                await endpoints.plans.create(formData);
            }

            setShowModal(false);
            loadPlans();
        } catch (error) {
            console.error(error);
        }
    };

    const deletePlan = async (id) => {
        const confirmed = window.confirm(
            "Delete this plan?"
        );

        if (!confirmed) {
            return;
        }

        try {
            await endpoints.plans.remove(id);
            loadPlans();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div>
                    <h1>Plans</h1>

                    <p className="muted-text">
                        Manage SMS subscription plans.
                    </p>
                </div>

                <button
                    className="primary-button"
                    onClick={openCreateModal}
                    type="button"
                >
                    Create Plan
                </button>
            </div>

            <div className="panel no-margin">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Plan Name</th>
                            <th>Description</th>
                            <th>Price</th>
                            <th>Payment Type</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {plans.map((plan) => (
                            <tr key={plan.id}>
                                <td>{plan.plan_name}</td>
                                <td>{plan.description}</td>
                                <td>&#8369;{plan.price}</td>
                                <td>{plan.payment_type}</td>
                                <td>
                                    <button
                                        onClick={() =>
                                            openEditModal(plan)
                                        }
                                        type="button"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        className="button-gap"
                                        onClick={() =>
                                            deletePlan(plan.id)
                                        }
                                        type="button"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-panel">
                        <h2>
                            {editingPlan
                                ? "Edit Plan"
                                : "Create Plan"}
                        </h2>

                        <form onSubmit={handleSubmit}>
                            <input
                                className="form-input modal-input"
                                onChange={(event) =>
                                    updateFormData(
                                        "plan_name",
                                        event.target.value
                                    )
                                }
                                placeholder="Plan Name"
                                required
                                type="text"
                                value={formData.plan_name}
                            />

                            <textarea
                                className="form-textarea"
                                onChange={(event) =>
                                    updateFormData(
                                        "description",
                                        event.target.value
                                    )
                                }
                                placeholder="Description"
                                required
                                value={formData.description}
                            />

                            <input
                                className="form-input modal-input"
                                onChange={(event) =>
                                    updateFormData(
                                        "price",
                                        event.target.value
                                    )
                                }
                                placeholder="Price"
                                required
                                step="0.01"
                                type="number"
                                value={formData.price}
                            />

                            <input
                                className="form-input modal-last-input"
                                onChange={(event) =>
                                    updateFormData(
                                        "payment_type",
                                        event.target.value
                                    )
                                }
                                placeholder="Payment Type"
                                required
                                type="text"
                                value={formData.payment_type}
                            />

                            <button type="submit">
                                Save
                            </button>

                            <button
                                className="button-gap"
                                onClick={() =>
                                    setShowModal(false)
                                }
                                type="button"
                            >
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

export default Plans;
