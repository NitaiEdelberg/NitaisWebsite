import {create} from "zustand";

//global state for products
// Zustand is a small, fast and scalable bearbones state-management solution using simplified flux principles.
export const useProductStore = create((set) => ({
    products: [],
    setProducts: (products) => set({ products }),
    createProduct: async(newProduct) => {
        if(!newProduct.name || !newProduct.price || !newProduct.image) {
            return {success: false, message: "Please fill all fields."}
        }
        const res = await fetch("/api/products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(newProduct),
        });
        const data = await res.json();
        set((state) => ({
            products: [...state.products, data.data],
        }));
        return {success: true, message: "product created successfully"}
    },
    fetchProducts: async () => {
        const res = await fetch("/api/products");
        const data = await res.json();
        set({ products: data.data });
    },
    deleteProduct: async (id) => {
        const res = await fetch(`/api/products/${id}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if(!data.success) {
            return {success: false, message: data.message};
        }
        // update the ui immediately after deleting the product without needing to refresh the page
        set((state) => ({
            products: state.products.filter((product) => product._id !== id)
        }));
        return {success: true, message: data.message};

    },
    updateProduct: async (pid, updatedProduct) => {
        const res = await fetch(`/api/products/${pid}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedProduct),
        });
        const data = await res.json();
        if(!data.success) {
            return {success: false, message: data.message};
        }
        // update the ui immediately after updating the product without needing to refresh the page
        set((state) => ({
            products: state.products.map(product => product._id === pid ? data.data : product)
        }));

        return {success: true, message: data.message};
    }
}));
